<?php
namespace ahm\map\service;

/** sql_driver on phpBB's own database layer ($db): the map inside a board uses the connection phpBB uses. */
class dbal_driver implements sql_driver
{
    private $db;
    private $prefix;
    private $depth = 0;

    public function __construct($db, $prefix)
    {
        $this->db = $db;
        $this->prefix = $prefix;
    }

    public function name()
    {
        return stripos($this->db->get_sql_layer(), 'sqlite') !== false ? 'sqlite' : 'mysql';
    }

    public function prefix()
    {
        return $this->prefix;
    }

    /** The statement with its parameters put in as quoted, escaped values (the layer of phpBB has no prepared statements). */
    private function bind($sql, array $params)
    {
        $i = 0;
        return preg_replace_callback('/\?/', function () use (&$i, $params) {
            $v = $params[$i++];
            if ($v === null) {
                return 'NULL';
            }
            if (is_int($v)) {
                return (string) $v;
            }
            if (is_float($v)) {
                return json_encode($v);
            }
            if (is_bool($v)) {
                return $v ? '1' : '0';
            }
            return "'" . $this->db->sql_escape((string) $v) . "'";
        }, $sql);
    }

    public function rows($sql, array $params = [])
    {
        $res = $this->db->sql_query($this->bind($sql, $params));
        $out = [];
        while ($r = $this->db->sql_fetchrow($res)) {
            $out[] = $r;
        }
        $this->db->sql_freeresult($res);
        return $out;
    }

    public function value($sql, array $params = [])
    {
        $res = $this->db->sql_query($this->bind($sql, $params));
        $r = $this->db->sql_fetchrow($res);
        $this->db->sql_freeresult($res);
        return $r ? array_shift($r) : null;
    }

    public function exec($sql, array $params = [])
    {
        $this->db->sql_query($this->bind($sql, $params));
        return (int) $this->db->sql_affectedrows();
    }

    public function insert_id()
    {
        return (int) $this->db->sql_nextid();
    }

    public function transaction(callable $fn)
    {
        if ($this->depth > 0) {
            return $fn();
        }
        $this->db->sql_transaction('begin');
        $this->depth = 1;
        try {
            $r = $fn();
            $this->db->sql_transaction('commit');
            return $r;
        } catch (\Throwable $e) {
            $this->db->sql_transaction('rollback');
            throw $e;
        } finally {
            $this->depth = 0;
        }
    }
}
