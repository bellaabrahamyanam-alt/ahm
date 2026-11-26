<?php
namespace ahm\map\service;

/** sql_driver on PDO (SQLite or MySQL/MariaDB): the tests and the tools. */
class pdo_driver implements sql_driver
{
    private $db;
    private $prefix;
    private $depth = 0;

    public function __construct(\PDO $db, $prefix = '')
    {
        $this->db = $db;
        $this->prefix = $prefix;
        $db->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(\PDO::ATTR_EMULATE_PREPARES, false);
        $db->setAttribute(\PDO::ATTR_STRINGIFY_FETCHES, false);
    }

    public function name()
    {
        return $this->db->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql' ? 'mysql' : 'sqlite';
    }

    public function prefix()
    {
        return $this->prefix;
    }

    private function run($sql, array $params)
    {
        $st = $this->db->prepare($sql);
        $i = 0;
        foreach ($params as $v) {
            $i++;
            if (is_float($v)) {
                $v = json_encode($v);   // the shortest exact text: no digit of a coordinate is lost
            }
            $st->bindValue($i, $v, $v === null ? \PDO::PARAM_NULL : (is_int($v) ? \PDO::PARAM_INT : \PDO::PARAM_STR));
        }
        $st->execute();
        return $st;
    }

    public function rows($sql, array $params = [])
    {
        $st = $this->run($sql, $params);
        $out = $st->fetchAll(\PDO::FETCH_ASSOC);
        $st->closeCursor();
        return $out;
    }

    public function value($sql, array $params = [])
    {
        $st = $this->run($sql, $params);
        $v = $st->fetchColumn();
        $st->closeCursor();
        return $v === false ? null : $v;
    }

    public function exec($sql, array $params = [])
    {
        $st = $this->run($sql, $params);
        $n = $st->rowCount();
        $st->closeCursor();
        return $n;
    }

    public function insert_id()
    {
        return (int) $this->db->lastInsertId();
    }

    public function transaction(callable $fn)
    {
        if ($this->depth > 0) {
            return $fn();
        }
        $this->db->beginTransaction();
        $this->depth = 1;
        try {
            $r = $fn();
            $this->db->commit();
            return $r;
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        } finally {
            $this->depth = 0;
        }
    }
}
