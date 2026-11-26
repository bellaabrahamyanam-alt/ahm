<?php
namespace ahm\map\service;

/** The little part of a database that sql_repository and sql_transfer need. pdo_driver (tests, tools) and dbal_driver (phpBB) implement it. */
interface sql_driver
{
    /** 'sqlite' or 'mysql' */
    public function name();

    /** Table prefix of the board (phpbb_), '' in tests. */
    public function prefix();

    /** All rows of a query as associative arrays. `?` marks a parameter; a float goes in as its shortest exact text. */
    public function rows($sql, array $params = []);

    /** The first column of the first row, null when there is none. */
    public function value($sql, array $params = []);

    /** Runs a statement; returns the number of rows it changed. */
    public function exec($sql, array $params = []);

    /** Id of the last row inserted into a table with an automatic id. */
    public function insert_id();

    /** Runs $fn in a transaction (all or nothing); a call inside another one joins it. Returns what $fn returns. */
    public function transaction(callable $fn);
}
