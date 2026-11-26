<?php
namespace ahm\map\service;

/** post_gateway that keeps topics and posts in arrays: for the tests and for tools that run without phpBB. */
class memory_gateway implements post_gateway
{
    public $topics = [];   // id => [kind, title, card, closed, first post id]
    public $posts = [];    // id => [topic, subject, text, user]
    public $user = 2;
    private $next_topic = 1;
    private $next_post = 1001;

    public function make_topic($kind, $title, $card)
    {
        $t = $this->next_topic++;
        $p = $this->next_post++;
        $this->posts[$p] = [$t, $title, $card, $this->user];
        $this->topics[$t] = ['kind' => $kind, 'title' => $title, 'card' => $card, 'closed' => false, 'first' => $p];
        return $t;
    }

    public function update_card($topic_id, $title, $card)
    {
        $t = &$this->topics[$topic_id];
        $t['title'] = $title;
        $t['card'] = $card;
        $this->posts[$t['first']] = [$topic_id, $title, $card, $this->posts[$t['first']][3]];
    }

    public function close_topic($topic_id)
    {
        $this->topics[$topic_id]['closed'] = true;
    }

    public function add_post($topic_id, $subject, $text)
    {
        $p = $this->next_post++;
        $this->posts[$p] = [$topic_id, $subject, $text, $this->user];
        return $p;
    }

    public function edit_post($post_id, $subject, $text)
    {
        $this->posts[$post_id] = [$this->posts[$post_id][0], $subject, $text, $this->posts[$post_id][3]];
    }

    public function posts(array $topic_ids)
    {
        $out = [];
        ksort($this->posts);
        foreach ($this->posts as $id => $p) {
            if (in_array($p[0], $topic_ids, true) && $this->topics[$p[0]]['first'] !== $id) {
                $out[$id] = ['topic' => $p[0], 'subject' => $p[1], 'text' => $p[2], 'user' => $p[3]];
            }
        }
        return $out;
    }
}
