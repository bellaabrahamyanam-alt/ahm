<?php
namespace ahm\map\service;

/**
 * The data in the tables ahm_objects, ahm_lists, ahm_note_meta, ahm_revisions and the posts of phpBB (T-104). A document of the store is built
 * from the rows and written back as a difference: only the rows that changed are written, and every change adds a revision (the state
 * after it, gzip JSON). With a post_gateway an object gets its topic with the card when it is made, and a note is a post of that topic.
 */
class sql_repository implements repository
{
    const KIND = ['places' => 'place', 'shapes' => 'shape', 'layers' => 'layer'];

    private $db;
    private $posts;
    private $actor;
    private $lock;
    private $p;

    /**
     * $actor: the user who makes the changes (phpBB's user id). $lock_file: a file that serialises the writers of a board; null where there is
     * only one (tests). The calls of the gateway never run inside a database transaction: phpBB's posting function manages its own
     * transactions (a nested one is rolled back), so a change first does what the forum needs, then writes its rows in one transaction.
     */
    public function __construct(sql_driver $db, post_gateway $posts = null, $actor = null, $lock_file = null)
    {
        $this->db = $db;
        $this->posts = $posts;
        $this->actor = $actor;
        $this->lock = $lock_file;
        $this->p = $db->prefix();
    }

    /** The user who makes the changes from now on (phpBB's user id): it goes to the revisions. */
    public function set_actor($user_id)
    {
        $this->actor = $user_id;
    }

    private function t($name)
    {
        return $this->p . $name;
    }

    public function transaction(callable $fn)
    {
        if ($this->lock === null) {
            return $fn();
        }
        @mkdir(dirname($this->lock), 0775, true);
        $h = fopen($this->lock, 'c');
        flock($h, LOCK_EX);
        try {
            return $fn();
        } finally {
            flock($h, LOCK_UN);
            fclose($h);
        }
    }

    // ---- documents

    private static function canon($v)
    {
        if (!is_array($v)) {
            return $v;
        }
        if ($v === [] || array_keys($v) === range(0, count($v) - 1)) {
            return array_map([__CLASS__, 'canon'], $v);
        }
        ksort($v);
        return array_map([__CLASS__, 'canon'], $v);
    }

    private static function same($a, $b)
    {
        return json_encode(self::canon($a), sql_transfer::JSON) === json_encode(self::canon($b), sql_transfer::JSON);
    }

    private function object_rows($kind)
    {
        $out = [];
        foreach ($this->db->rows('SELECT id, pos, lon, lat, type, topic_id, version, created_at, updated_at, data FROM ' . $this->t('ahm_objects') . ' WHERE kind = ? ORDER BY pos, id', [$kind]) as $r) {
            $r['data'] = json_decode($r['data'], true);
            $r['lon'] = $r['lon'] === null ? null : (float) $r['lon'];
            $r['lat'] = $r['lat'] === null ? null : (float) $r['lat'];
            $r['topic_id'] = $r['topic_id'] === null ? null : (int) $r['topic_id'];
            $r['pos'] = (int) $r['pos'];
            $out[$r['id']] = $r;
        }
        return $out;
    }

    public function doc($name)
    {
        if (isset(self::KIND[$name])) {
            $kind = self::KIND[$name];
            $entries = [];
            foreach ($this->object_rows($kind) as $r) {
                $entries[] = sql_transfer::entry_from_object($kind, $r);
            }
            if ($name === 'places') {
                return ['type' => 'FeatureCollection', 'version' => sql_transfer::PLACES_VERSION, 'features' => $entries];
            }
            if ($name === 'shapes') {
                return ['type' => 'FeatureCollection', 'features' => $entries];
            }
            return $entries ? ['version' => 1, 'layers' => $entries] : null;
        }
        if (isset(sql_transfer::LISTS[$name])) {
            $items = [];
            foreach ($this->db->rows('SELECT item_key, data FROM ' . $this->t('ahm_lists') . ' WHERE list = ? ORDER BY pos, item_key', [$name]) as $r) {
                $items[] = sql_transfer::list_entry($name, $r['item_key'], json_decode($r['data'], true));
            }
            return $items ? ['version' => sql_transfer::FILE_VERSION, sql_transfer::LISTS[$name][0] => $items] : null;
        }
        throw new \InvalidArgumentException("unknown document $name");
    }

    public function put_doc($name, array $d)
    {
        if (isset(self::KIND[$name])) {
            $this->put_objects(self::KIND[$name], $name === 'layers' ? $d['layers'] : $d['features']);
        } elseif (isset(sql_transfer::LISTS[$name])) {
            $this->db->transaction(function () use ($name, $d) {
                $this->put_list($name, $d[sql_transfer::LISTS[$name][0]]);
            });
        } else {
            throw new \InvalidArgumentException("unknown document $name");
        }
    }

    private function revision($kind, $id, $action, $label, array $state)
    {
        $no = 1 + (int) $this->db->value('SELECT MAX(rev_no) FROM ' . $this->t('ahm_revisions') . ' WHERE entity_kind = ? AND entity_id = ?', [$kind, (string) $id]);
        $this->db->exec(
            'INSERT INTO ' . $this->t('ahm_revisions') . ' (entity_kind, entity_id, rev_no, action, user_id, at, label, snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$kind, (string) $id, $no, $action, $this->actor, time(), mb_substr($label, 0, 255), sql_transfer::snapshot($state)]
        );
    }

    private function card_text($kind, array $o, array $lists)
    {
        return card::text(['kind' => $kind, 'type' => $o['type'], 'lon' => $o['lon'], 'lat' => $o['lat'], 'data' => $o['data']], $lists);
    }

    private function lists()
    {
        return (new sql_transfer($this->db))->lists();
    }

    /** Writes the objects of one kind as the difference to what is in the table: the forum first, then the rows in one transaction. */
    private function put_objects($kind, array $entries)
    {
        $now = time();
        $cur = $this->object_rows($kind);
        $lists = null;
        $seen = [];
        $writes = [];   // what to write to the tables, in order: [sql, params] or a revision
        foreach ($entries as $pos => $e) {
            $o = sql_transfer::object_from_entry($kind, $e);
            $id = $o['id'];
            $seen[$id] = true;
            $label = sql_transfer::label($o['data']['names'] ?? []);
            if (!isset($cur[$id])) {
                $topic = null;
                if ($this->posts) {
                    $lists = $lists ?: $this->lists();
                    $topic = $this->shared_topic($cur, $o) ?: $this->posts->make_topic($kind, $label, $this->card_text($kind, $o, $lists));
                }
                $writes[] = ['INSERT INTO ' . $this->t('ahm_objects') . ' (id, kind, pos, lon, lat, type, topic_id, version, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)',
                    [$id, $kind, $pos, $o['lon'], $o['lat'], $o['type'], $topic, $o['created'] ?? $now, $o['updated'] ?? $now, sql_transfer::json($o['data'])]];
                $writes[] = ['revision', $kind, $id, 'create', $label, $e];
                $cur[$id] = ['id' => $id, 'data' => $o['data'], 'topic_id' => $topic];
                continue;
            }
            $r = $cur[$id];
            $moved = $r['lon'] === null ? false : (abs($r['lon'] - $o['lon']) > 1e-12 || abs($r['lat'] - $o['lat']) > 1e-12);
            $changed = $moved || (string) $r['type'] !== (string) $o['type'] || !self::same($r['data'], $o['data'])
                || ($o['updated'] !== null && (int) $r['updated_at'] !== (int) $o['updated']);
            if ($changed) {
                $topic = $r['topic_id'];
                if ($this->posts) {
                    $lists = $lists ?: $this->lists();
                    $new = $this->card_text($kind, $o, $lists);
                    if ($topic === null) {
                        $topic = $this->posts->make_topic($kind, $label, $new);
                    } elseif ($new !== $this->card_text($kind, $r, $lists) || $label !== sql_transfer::label($r['data']['names'] ?? [])) {
                        $this->posts->update_card($topic, $label, $new);
                    }
                }
                $writes[] = ['UPDATE ' . $this->t('ahm_objects') . ' SET pos = ?, lon = ?, lat = ?, type = ?, topic_id = ?, version = version + 1, updated_at = ?, data = ? WHERE id = ?',
                    [$pos, $o['lon'], $o['lat'], $o['type'], $topic, $o['updated'] ?? $now, sql_transfer::json($o['data']), $id]];
                $writes[] = ['revision', $kind, $id, 'edit', $label, $e];
            } elseif ($r['pos'] !== $pos) {
                $writes[] = ['UPDATE ' . $this->t('ahm_objects') . ' SET pos = ? WHERE id = ?', [$pos, $id]];
            }
        }
        foreach ($cur as $id => $r) {
            if (isset($seen[$id])) {
                continue;
            }
            $writes[] = ['revision', $kind, $id, 'delete', sql_transfer::label($r['data']['names'] ?? []), sql_transfer::entry_from_object($kind, $r)];
            $writes[] = ['DELETE FROM ' . $this->t('ahm_objects') . ' WHERE id = ?', [$id]];
            if ($this->posts && $r['topic_id'] !== null && !$this->topic_used_elsewhere($cur, $seen, $r['topic_id'])) {
                $this->posts->close_topic($r['topic_id']);
            }
        }
        $this->db->transaction(function () use ($writes) {
            foreach ($writes as $w) {
                if ($w[0] === 'revision') {
                    $this->revision($w[1], $w[2], $w[3], $w[4], $w[5]);
                } else {
                    $this->db->exec($w[0], $w[1]);
                }
            }
        });
    }

    /** Is the topic still the topic of an object that stays (a border drawn in several versions shares one)? */
    private function topic_used_elsewhere(array $cur, array $seen, $topic)
    {
        foreach ($cur as $id => $r) {
            if (isset($seen[$id]) && $r['topic_id'] === $topic) {
                return true;
            }
        }
        return false;
    }

    /** The topic of another version of the same series (a border that was drawn again), null when there is none. */
    private function shared_topic(array $cur, array $o)
    {
        $series = $o['data']['series'] ?? null;
        if ($series !== null) {
            foreach ($cur as $r) {
                if (($r['data']['series'] ?? null) === $series && $r['topic_id'] !== null) {
                    return $r['topic_id'];
                }
            }
        }
        return null;
    }

    private function put_list($list, array $items)
    {
        $now = time();
        $cur = [];
        foreach ($this->db->rows('SELECT item_key, pos, data FROM ' . $this->t('ahm_lists') . ' WHERE list = ?', [$list]) as $r) {
            $cur[$r['item_key']] = ['pos' => (int) $r['pos'], 'data' => json_decode($r['data'], true)];
        }
        $seen = [];
        foreach ($items as $pos => $item) {
            list($key, $data) = sql_transfer::list_parts($list, $item);
            $seen[$key] = true;
            $label = sql_transfer::label($data['names'] ?? []) ?: (string) ($data['title'] ?? $data['name'] ?? $key);
            if (!isset($cur[$key])) {
                $this->db->exec('INSERT INTO ' . $this->t('ahm_lists') . ' (list, item_key, pos, version, updated_at, data) VALUES (?, ?, ?, 1, ?, ?)', [$list, $key, $pos, $now, sql_transfer::json($data)]);
                $this->revision('list', "$list/$key", 'create', $label, $item);
            } elseif (!self::same($cur[$key]['data'], $data)) {
                $this->db->exec('UPDATE ' . $this->t('ahm_lists') . ' SET pos = ?, version = version + 1, updated_at = ?, data = ? WHERE list = ? AND item_key = ?', [$pos, $now, sql_transfer::json($data), $list, $key]);
                $this->revision('list', "$list/$key", 'edit', $label, $item);
            } elseif ($cur[$key]['pos'] !== $pos) {
                $this->db->exec('UPDATE ' . $this->t('ahm_lists') . ' SET pos = ? WHERE list = ? AND item_key = ?', [$pos, $list, $key]);
            }
        }
        foreach ($cur as $key => $r) {
            if (!isset($seen[$key])) {
                $this->revision('list', "$list/$key", 'delete', (string) $key, sql_transfer::list_entry($list, $key, $r['data']));
                $this->db->exec('DELETE FROM ' . $this->t('ahm_lists') . ' WHERE list = ? AND item_key = ?', [$list, $key]);
            }
        }
    }

    /** Makes the topic (with the card) of every object that has none. Returns how many were made. */
    public function ensure_topics()
    {
        if (!$this->posts) {
            return 0;
        }
        $n = 0;
        $lists = $this->lists();
        foreach (self::KIND as $kind) {
            $cur = $this->object_rows($kind);
            foreach ($cur as $id => $r) {
                if ($r['topic_id'] !== null) {
                    continue;
                }
                $o = ['id' => $id, 'type' => $r['type'], 'lon' => $r['lon'], 'lat' => $r['lat'], 'data' => $r['data']];
                $topic = $this->shared_topic($cur, $o) ?: $this->posts->make_topic($kind, sql_transfer::label($r['data']['names'] ?? []), $this->card_text($kind, $o, $lists));
                $this->db->exec('UPDATE ' . $this->t('ahm_objects') . ' SET topic_id = ? WHERE id = ?', [$topic, $id]);
                $cur[$id]['topic_id'] = $topic;
                $n++;
            }
        }
        return $n;
    }

    // ---- notes

    /** The id of a post that has no ahm_note_meta (written in the forum): a UUID made from its number. */
    public static function post_uuid($post_id)
    {
        return sprintf('00000000-0000-4000-8000-%012d', $post_id);
    }

    private function meta_by_posts(array $post_ids)
    {
        $out = [];
        foreach (array_chunk($post_ids, 200) as $chunk) {
            $in = implode(', ', array_fill(0, count($chunk), '?'));
            foreach ($this->db->rows('SELECT post_id, data FROM ' . $this->t('ahm_note_meta') . " WHERE post_id IN ($in)", array_map('intval', $chunk)) as $r) {
                $out[(int) $r['post_id']] = json_decode($r['data'], true);
            }
        }
        return $out;
    }

    public function notes($owner = null)
    {
        if (!$this->posts) {
            return [];
        }
        $owners = [];   // topic => [object id, kind]
        $sql = 'SELECT id, kind, topic_id FROM ' . $this->t('ahm_objects') . ' WHERE topic_id IS NOT NULL';
        foreach ($this->db->rows($owner === null ? $sql . ' ORDER BY kind, pos' : $sql . ' AND id = ?', $owner === null ? [] : [$owner]) as $r) {
            if (!isset($owners[(int) $r['topic_id']])) {
                $owners[(int) $r['topic_id']] = [$r['id'], $r['kind'] === 'place' ? 'place' : 'layer'];
            }
        }
        if (!$owners) {
            return [];
        }
        $posts = $this->posts->posts(array_keys($owners));
        $metas = $this->meta_by_posts(array_keys($posts));
        $out = [];
        foreach ($posts as $post_id => $p) {
            list($oid, $kind) = $owners[$p['topic']];
            $m = $metas[$post_id] ?? [];
            $out[] = [
                'owner' => $oid, 'kind' => $kind, 'id' => $m['uuid'] ?? self::post_uuid($post_id),
                'lang' => $m['lang'] ?? 'en', 'title' => $p['subject'], 'date' => $m['date'] ?? null,
                'layers' => $kind === 'place' ? ($m['layers'] ?? []) : [], 'text' => trim($p['text']),
            ];
        }
        return $out;
    }

    /** The post of a note: by the uuid in its meta, or (a post written in the forum) by the number in its generated uuid. */
    private function post_of($uuid)
    {
        if (preg_match('/^00000000-0000-4000-8000-(\d{12})$/', $uuid, $m)) {
            return (int) $m[1];
        }
        $col = $this->db->name() === 'mysql' ? 'CAST(data AS CHAR)' : 'data';
        $v = $this->db->value('SELECT post_id FROM ' . $this->t('ahm_note_meta') . " WHERE $col LIKE ?", ['%' . $uuid . '%']);
        return $v === null ? null : (int) $v;
    }

    public function note($owner, $id)
    {
        foreach ($this->notes($owner) as $n) {
            if ($n['id'] === $id) {
                return $n;
            }
        }
        return null;
    }

    public function put_note(array $n, $reason = '')
    {
        if (!$this->posts) {
            throw new \RuntimeException('notes are posts of the forum: the repository needs a post gateway');
        }
        $obj = $this->db->rows('SELECT id, kind, type, lon, lat, topic_id, data FROM ' . $this->t('ahm_objects') . ' WHERE id = ?', [$n['owner']]);
        if (!$obj) {
            throw new \InvalidArgumentException('unknown owner of a note');
        }
        $obj = $obj[0];
        // the forum first (its posting function runs its own transactions) ...
        $topic = $obj['topic_id'] === null ? null : (int) $obj['topic_id'];
        $new_topic = false;
        if ($topic === null) {
            $o = ['id' => $obj['id'], 'type' => $obj['type'], 'lon' => $obj['lon'] === null ? null : (float) $obj['lon'], 'lat' => $obj['lat'] === null ? null : (float) $obj['lat'], 'data' => json_decode($obj['data'], true)];
            $topic = $this->posts->make_topic($obj['kind'], sql_transfer::label($o['data']['names'] ?? []), $this->card_text($obj['kind'], $o, $this->lists()));
            $new_topic = true;
        }
        $post = $this->post_of($n['id']);
        $new = $post === null;
        if ($new) {
            $post = $this->posts->add_post($topic, $n['title'], $n['text']);
        } elseif ($reason !== 'untag') {
            $this->posts->edit_post($post, $n['title'], $n['text']);
        }
        // ... then our rows, together
        $meta = ['uuid' => $n['id'], 'lang' => $n['lang'], 'date' => $n['date'], 'layers' => $n['layers']];
        $this->db->transaction(function () use ($n, $obj, $topic, $new_topic, $post, $new, $meta) {
            if ($new_topic) {
                $this->db->exec('UPDATE ' . $this->t('ahm_objects') . ' SET topic_id = ? WHERE id = ?', [$topic, $obj['id']]);
            }
            if ($this->db->exec('UPDATE ' . $this->t('ahm_note_meta') . ' SET data = ? WHERE post_id = ?', [sql_transfer::json($meta), $post]) === 0
                && !$this->db->value('SELECT post_id FROM ' . $this->t('ahm_note_meta') . ' WHERE post_id = ?', [$post])) {
                $this->db->exec('INSERT INTO ' . $this->t('ahm_note_meta') . ' (post_id, data) VALUES (?, ?)', [$post, sql_transfer::json($meta)]);
            }
            $this->revision('note', $post, $new ? 'create' : 'edit', $n['title'], ['subject' => $n['title'], 'text' => $n['text']] + $meta);
        });
    }

    public function remove_notes($owner)
    {
        // the notes are posts of the topic of a deleted object: put_doc has closed the topic, and without its object the notes are not listed
    }
}
