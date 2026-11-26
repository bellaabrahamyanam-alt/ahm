<?php
namespace ahm\map\service;

/**
 * The posts of phpBB that hold the notes (T-099..T-101): a topic for every place, shape and layer, whose first post is the card, and
 * one post for every note. phpbb_gateway does it in a board; memory_gateway keeps the posts in an array (tests, tools).
 */
interface post_gateway
{
    /** Makes the topic of an object with its card (the first post); returns the topic id. $kind is place, shape or layer. */
    public function make_topic($kind, $title, $card);

    /** Rewrites the card and the title of a topic. */
    public function update_card($topic_id, $title, $card);

    /** Closes a topic (its object is deleted; the posts stay). */
    public function close_topic($topic_id);

    /** Adds a post to a topic; returns the post id. */
    public function add_post($topic_id, $subject, $text);

    /** Changes the subject and the text of a post. */
    public function edit_post($post_id, $subject, $text);

    /** The posts after the card of these topics, in the order of writing: post id => [topic, subject, text, user]. */
    public function posts(array $topic_ids);
}
