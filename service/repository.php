<?php
namespace ahm\map\service;

/**
 * Where the data of the map lives (T-104). store.php holds the rules and asks a repository to keep and give back the data:
 * file_repository (files; tests and tools) and sql_repository (the ahm_* tables and the posts of phpBB; the map).
 *
 * A document is what one file used to hold, as an array: 'places' and 'shapes' (GeoJSON FeatureCollections), 'layers', 'languages',
 * 'categories', 'types', 'sources' and 'overlays' ({"version": 1, "<name>": [...]}).
 * A note is an array: owner (UUID of the place, layer or shape), kind ('place' or 'layer'; a shape's notes are layer notes), id (UUID),
 * lang, title, date (array or null), layers (UUIDs, place notes only), text.
 */
interface repository
{
    /** A document, null when it does not exist yet, false when it exists but cannot be read. */
    public function doc($name);

    /** Replaces a document ($name as above). The old state is kept for the history (archive files, or revisions). */
    public function put_doc($name, array $d);

    /** Notes of one owner, or all notes when $owner is null. */
    public function notes($owner = null);

    /** One note or null. */
    public function note($owner, $id);

    /** Adds a note or replaces the one with this id. $reason is '' or 'untag' (only its layers changed). */
    public function put_note(array $n, $reason = '');

    /** Removes all notes of an owner (a layer or shape that is deleted); the history keeps them. */
    public function remove_notes($owner);

    /** Runs $fn with the data locked against other writers; returns what $fn returns. */
    public function transaction(callable $fn);
}
