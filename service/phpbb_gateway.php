<?php
namespace ahm\map\service;

/**
 * post_gateway on phpBB: the topics and posts of the forum "Map" (forums Places, Layers, Shapes), made with phpBB's own posting function
 * submit_post(), so that counters, the search index and notifications stay right. The forums are made the first time they are needed.
 * A note is stored as plain text (no BBCode, smilies or links are parsed), so that it comes back exactly as it was written; the card is BBCode.
 * Works in a request or a command of phpBB, as the user who is logged in there.
 */
class phpbb_gateway implements post_gateway
{
    const FORUMS = ['place' => 'Places', 'layer' => 'Layers', 'shape' => 'Shapes'];

    private $db;
    private $p;
    private $root;
    private $ext;
    private $forums = [];

    public function __construct($db, $table_prefix, $root_path, $php_ext = 'php')
    {
        $this->db = $db;
        $this->p = $table_prefix;
        $this->root = $root_path;
        $this->ext = $php_ext;
    }

    private function load($what)
    {
        foreach ($what as $f) {
            if (!function_exists($f[0])) {
                require_once $this->root . 'includes/' . $f[1] . '.' . $this->ext;
            }
        }
    }

    private function one($sql)
    {
        $r = $this->db->sql_query($sql);
        $row = $this->db->sql_fetchrow($r);
        $this->db->sql_freeresult($r);
        return $row ?: null;
    }

    private function forum_by_name($name, $parent)
    {
        $row = $this->one('SELECT forum_id FROM ' . $this->p . "forums WHERE forum_name = '" . $this->db->sql_escape($name) . "' AND parent_id = " . (int) $parent);
        return $row ? (int) $row['forum_id'] : 0;
    }

    private function make_forum($name, $parent, $type)
    {
        $this->load([['submit_post', 'functions_posting'], ['validate_range', 'functions_acp']]);
        if (!class_exists('acp_forums', false)) {
            require_once $this->root . 'includes/acp/acp_forums.' . $this->ext;
        }
        $acp = new \acp_forums();
        $acp->parent_id = 0;
        $d = ['parent_id' => $parent, 'forum_type' => $type, 'type_action' => '', 'forum_status' => ITEM_UNLOCKED, 'forum_parents' => '', 'forum_name' => $name, 'forum_link' => '', 'forum_link_track' => false,
            'forum_desc' => '', 'forum_desc_uid' => '', 'forum_desc_options' => 7, 'forum_desc_bitfield' => '', 'forum_rules' => '', 'forum_rules_uid' => '', 'forum_rules_options' => 7, 'forum_rules_bitfield' => '',
            'forum_rules_link' => '', 'forum_image' => '', 'forum_style' => 0, 'display_subforum_list' => true, 'display_subforum_limit' => false, 'display_on_index' => true, 'forum_topics_per_page' => 0,
            'enable_indexing' => true, 'enable_icons' => false, 'enable_prune' => false, 'enable_post_review' => true, 'enable_quick_reply' => false, 'enable_shadow_prune' => false, 'prune_days' => 7,
            'prune_viewed' => 7, 'prune_freq' => 1, 'prune_old_polls' => false, 'prune_announce' => false, 'prune_sticky' => false, 'prune_shadow_days' => 7, 'prune_shadow_freq' => 1, 'forum_password' => '',
            'forum_password_confirm' => '', 'forum_password_unset' => false, 'forum_flags' => 32, 'forum_options' => 0, 'show_active' => true];
        $errors = $acp->update_forum_data($d);
        if ($errors) {
            throw new \RuntimeException('forum ' . $name . ': ' . implode('; ', $errors));
        }
        return (int) $d['forum_id'];
    }

    /** The forum of a kind of object (place, layer, shape); makes the forums Map, Places, Layers and Shapes when they are not there. */
    public function forum_id($kind)
    {
        if (!isset($this->forums[$kind])) {
            $map = $this->forum_by_name('Map', 0) ?: $this->make_forum('Map', 0, FORUM_CAT);
            $name = self::FORUMS[$kind];
            $this->forums[$kind] = $this->forum_by_name($name, $map) ?: $this->make_forum($name, $map, FORUM_POST);
        }
        return $this->forums[$kind];
    }

    /** The data phpBB's submit_post() wants for a new post. $bbcode: the text is BBCode (the card), else plain text. */
    private function data($forum_id, $topic_id, $subject, $text, $bbcode, $locked)
    {
        global $user;
        $this->load([['submit_post', 'functions_posting'], ['generate_text_for_storage', 'functions_content']]);
        $uid = $bitfield = '';
        $opt = 0;
        $text = trim($text) === '' ? '-' : $text;
        generate_text_for_storage($text, $uid, $bitfield, $opt, $bbcode, $bbcode, $bbcode);
        return ['forum_id' => $forum_id, 'topic_id' => $topic_id, 'icon_id' => 0, 'poster_id' => $user->data['user_id'], 'enable_bbcode' => $bbcode, 'enable_smilies' => $bbcode,
            'enable_urls' => $bbcode, 'enable_sig' => false, 'message' => $text, 'message_md5' => md5($text), 'attachment_data' => [], 'filename_data' => ['filename' => ''],
            'bbcode_bitfield' => $bitfield, 'bbcode_uid' => $uid, 'post_edit_locked' => $locked ? 1 : 0, 'topic_title' => $subject, 'notify_set' => false, 'notify' => false,
            'post_time' => 0, 'forum_name' => '', 'enable_indexing' => true, 'force_approved_state' => true, 'force_visibility' => true];
    }

    private function submit($mode, $subject, array &$data)
    {
        $poll = [];
        submit_post($mode, mb_substr($subject, 0, 255), '', POST_NORMAL, $poll, $data);
    }

    public function make_topic($kind, $title, $card)
    {
        $d = $this->data($this->forum_id($kind), 0, $title, $card, true, true);
        $this->submit('post', $title, $d);
        return (int) $d['topic_id'];
    }

    /** The row of a post and of its topic, as submit_post() wants it for an edit. */
    private function post_row($post_id)
    {
        $row = $this->one('SELECT p.*, t.topic_first_post_id, t.topic_last_post_id, t.topic_poster, t.topic_posts_approved, t.topic_posts_unapproved, t.topic_posts_softdeleted, t.topic_visibility, t.topic_time_limit, t.topic_type, t.topic_title'
            . ' FROM ' . $this->p . 'posts p JOIN ' . $this->p . 'topics t ON t.topic_id = p.topic_id WHERE p.post_id = ' . (int) $post_id);
        if (!$row) {
            throw new \InvalidArgumentException("no post $post_id");
        }
        return $row;
    }

    private function edit($post_id, $subject, $text, $bbcode, $locked)
    {
        $row = $this->post_row($post_id);
        $d = $this->data((int) $row['forum_id'], (int) $row['topic_id'], $subject, $text, $bbcode, $locked) + [];
        $d += ['post_id' => (int) $post_id, 'topic_first_post_id' => $row['topic_first_post_id'], 'topic_last_post_id' => $row['topic_last_post_id'], 'topic_poster' => $row['topic_poster'],
            'post_edit_reason' => '', 'post_edit_user' => $row['post_edit_user'], 'post_edit_time' => $row['post_edit_time'], 'post_edit_count' => $row['post_edit_count'],
            'post_visibility' => $row['post_visibility'], 'topic_visibility' => $row['topic_visibility'], 'topic_posts_approved' => $row['topic_posts_approved'],
            'topic_posts_unapproved' => $row['topic_posts_unapproved'], 'topic_posts_softdeleted' => $row['topic_posts_softdeleted'], 'poster_ip' => $row['poster_ip'],
            'post_username' => $row['post_username'], 'topic_time_limit' => $row['topic_time_limit'], 'post_postcount' => 1, 'poll_title' => '', 'topic_type' => $row['topic_type']];
        $d['poster_id'] = (int) $row['poster_id'];   // an edit never changes who wrote the post
        $d['post_time'] = (int) $row['post_time'];
        $this->submit('edit', $subject, $d);
    }

    public function update_card($topic_id, $title, $card)
    {
        $t = $this->one('SELECT topic_first_post_id FROM ' . $this->p . 'topics WHERE topic_id = ' . (int) $topic_id);
        if ($t) {
            $this->edit((int) $t['topic_first_post_id'], $title, $card, true, true);   // the title of the topic follows the first post
        }
    }

    public function close_topic($topic_id)
    {
        $this->db->sql_query('UPDATE ' . $this->p . 'topics SET topic_status = ' . ITEM_LOCKED . ' WHERE topic_id = ' . (int) $topic_id);
    }

    public function add_post($topic_id, $subject, $text)
    {
        $t = $this->one('SELECT forum_id FROM ' . $this->p . 'topics WHERE topic_id = ' . (int) $topic_id);
        if (!$t) {
            throw new \InvalidArgumentException("no topic $topic_id");
        }
        $d = $this->data((int) $t['forum_id'], (int) $topic_id, $subject, $text, false, false);
        $this->submit('reply', $subject, $d);
        return (int) $d['post_id'];
    }

    public function edit_post($post_id, $subject, $text)
    {
        $this->edit($post_id, $subject, $text, false, false);
    }

    public function posts(array $topic_ids)
    {
        $out = [];
        if (!$topic_ids) {
            return $out;
        }
        $this->load([['generate_text_for_edit', 'functions_content']]);
        foreach (array_chunk(array_map('intval', $topic_ids), 200) as $chunk) {
            $r = $this->db->sql_query('SELECT p.post_id, p.topic_id, p.poster_id, p.post_subject, p.post_text, p.bbcode_uid, p.enable_bbcode, p.enable_smilies, p.enable_magic_url'
                . ' FROM ' . $this->p . 'posts p JOIN ' . $this->p . 'topics t ON t.topic_id = p.topic_id'
                . ' WHERE p.topic_id IN (' . implode(', ', $chunk) . ') AND p.post_id <> t.topic_first_post_id AND p.post_visibility = 1 ORDER BY p.post_id');
            while ($row = $this->db->sql_fetchrow($r)) {
                $flags = ($row['enable_bbcode'] ? OPTION_FLAG_BBCODE : 0) + ($row['enable_smilies'] ? OPTION_FLAG_SMILIES : 0) + ($row['enable_magic_url'] ? OPTION_FLAG_LINKS : 0);
                $text = generate_text_for_edit($row['post_text'], $row['bbcode_uid'], $flags)['text'];
                $out[(int) $row['post_id']] = ['topic' => (int) $row['topic_id'], 'subject' => $row['post_subject'], 'text' => $text, 'user' => (int) $row['poster_id']];
            }
            $this->db->sql_freeresult($r);
        }
        return $out;
    }
}
