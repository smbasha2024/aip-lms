import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const python = `${root}/backend/.venv/bin/python`;
function run(script: string) {
  execFileSync(python, ["-c", script], { cwd: root, env: { ...process.env, PYTHONPATH: `${root}/backend` }, stdio: "pipe" });
}
const common = `
import os, re
from sqlalchemy import create_engine
from app.config import Settings
name = os.environ['E2E_DATABASE_SCHEMA']
assert re.fullmatch(r'phase3_e2e_[a-f0-9]{32}', name)
settings = Settings(_env_file=None, app_env='test')
engine = create_engine(settings.effective_database_url, hide_parameters=True, connect_args={'connect_timeout':5})
`;
export default async function setup() {
  run(`${common}
from sqlalchemy.schema import CreateSchema
from alembic import command
from alembic.config import Config
from database.seed import SeedPasswords, seed_records
from sqlalchemy.orm import Session
with engine.connect() as connection:
    connection.execute(CreateSchema(name)); connection.commit()
    config = Config('database/alembic.ini'); config.attributes['connection'] = connection
    command.upgrade(config, 'head'); connection.commit()
    password = os.environ['E2E_TEST_PASSWORD']
    with Session(connection) as session, session.begin():
        seed_records(session, settings, SeedPasswords(_env_file=None, employee_password=password,
            manager_password=password, administrator_password=password))
engine.dispose()
`);
  return async () => {
    run(`${common}
from sqlalchemy.schema import DropSchema
with engine.begin() as connection:
    connection.execute(DropSchema(name, cascade=True))
engine.dispose()
`);
  };
}
