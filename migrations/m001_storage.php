<?php
namespace ahm\map\migrations;

/** Makes the tables of the extension (service/sql/schema.<driver>.sql): ahm_objects, ahm_lists, ahm_note_meta, ahm_imports, ahm_revisions. */
class m001_storage extends \phpbb\db\migration\migration
{
    public function effectively_installed()
    {
        return $this->db_tools->sql_table_exists($this->table_prefix . 'ahm_objects');
    }

    public static function depends_on()
    {
        return ['\phpbb\db\migration\data\v320\v320'];
    }

    public function update_data()
    {
        return [['custom', [[$this, 'create_tables']]]];
    }

    public function revert_data()
    {
        return [['custom', [[$this, 'drop_tables']]]];
    }

    public function create_tables()
    {
        $file = \ahm\map\service\sql_transfer::schema_file($this->db->get_sql_layer());
        foreach (\ahm\map\service\sql_transfer::statements($file, $this->table_prefix) as $sql) {
            $this->db->sql_query($sql);
        }
    }

    public function drop_tables()
    {
        foreach (array_reverse(\ahm\map\service\sql_transfer::TABLES) as $table) {
            $this->db->sql_query('DROP TABLE IF EXISTS ' . $this->table_prefix . $table);
        }
    }
}
