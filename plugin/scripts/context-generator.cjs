"use strict";var He=Object.create;var ee=Object.defineProperty;var Be=Object.getOwnPropertyDescriptor;var Ge=Object.getOwnPropertyNames;var Ye=Object.getPrototypeOf,Ve=Object.prototype.hasOwnProperty;var Ke=(d,e)=>{for(var s in e)ee(d,s,{get:e[s],enumerable:!0})},Re=(d,e,s,t)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of Ge(e))!Ve.call(d,r)&&r!==s&&ee(d,r,{get:()=>e[r],enumerable:!(t=Be(e,r))||t.enumerable});return d};var de=(d,e,s)=>(s=d!=null?He(Ye(d)):{},Re(e||!d||!d.__esModule?ee(s,"default",{value:d,enumerable:!0}):s,d)),qe=d=>Re(ee({},"__esModule",{value:!0}),d);var is={};Ke(is,{generateContext:()=>os});module.exports=qe(is);var ne=de(require("path"),1),ge=require("os"),K=require("fs");var Ue=require("bun:sqlite");var C=require("path"),De=require("os"),ve=require("fs");var ye=require("url");var V=require("fs"),Le=require("path"),Ce=require("os");var _e=["bugfix","feature","refactor","discovery","decision","change"],ce=["how-it-works","why-it-exists","what-changed","problem-solution","gotcha","pattern","trade-off"],Oe={bugfix:"\u{1F534}",feature:"\u{1F7E3}",refactor:"\u{1F504}",change:"\u2705",discovery:"\u{1F535}",decision:"\u2696\uFE0F","session-request":"\u{1F3AF}"},Ne={discovery:"\u{1F50D}",change:"\u{1F6E0}\uFE0F",feature:"\u{1F6E0}\uFE0F",bugfix:"\u{1F6E0}\uFE0F",refactor:"\u{1F6E0}\uFE0F",decision:"\u2696\uFE0F"},Ae=_e.join(","),Ie=ce.join(",");var ue=(i=>(i[i.DEBUG=0]="DEBUG",i[i.INFO=1]="INFO",i[i.WARN=2]="WARN",i[i.ERROR=3]="ERROR",i[i.SILENT=4]="SILENT",i))(ue||{}),pe=class{level=null;useColor;constructor(){this.useColor=process.stdout.isTTY??!1}getLevel(){if(this.level===null){let e=F.get("CLAUDE_MEM_LOG_LEVEL").toUpperCase();this.level=ue[e]??1}return this.level}correlationId(e,s){return`obs-${e}-${s}`}sessionId(e){return`session-${e}`}formatData(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof e=="number"||typeof e=="boolean")return e.toString();if(typeof e=="object"){if(e instanceof Error)return this.getLevel()===0?`${e.message}
${e.stack}`:e.message;if(Array.isArray(e))return`[${e.length} items]`;let s=Object.keys(e);return s.length===0?"{}":s.length<=3?JSON.stringify(e):`{${s.length} keys: ${s.slice(0,3).join(", ")}...}`}return String(e)}formatTool(e,s){if(!s)return e;try{let t=typeof s=="string"?JSON.parse(s):s;if(e==="Bash"&&t.command)return`${e}(${t.command})`;if(t.file_path)return`${e}(${t.file_path})`;if(t.notebook_path)return`${e}(${t.notebook_path})`;if(e==="Glob"&&t.pattern)return`${e}(${t.pattern})`;if(e==="Grep"&&t.pattern)return`${e}(${t.pattern})`;if(t.url)return`${e}(${t.url})`;if(t.query)return`${e}(${t.query})`;if(e==="Task"){if(t.subagent_type)return`${e}(${t.subagent_type})`;if(t.description)return`${e}(${t.description})`}return e==="Skill"&&t.skill?`${e}(${t.skill})`:e==="LSP"&&t.operation?`${e}(${t.operation})`:e}catch{return e}}formatTimestamp(e){let s=e.getFullYear(),t=String(e.getMonth()+1).padStart(2,"0"),r=String(e.getDate()).padStart(2,"0"),i=String(e.getHours()).padStart(2,"0"),a=String(e.getMinutes()).padStart(2,"0"),_=String(e.getSeconds()).padStart(2,"0"),u=String(e.getMilliseconds()).padStart(3,"0");return`${s}-${t}-${r} ${i}:${a}:${_}.${u}`}log(e,s,t,r,i){if(e<this.getLevel())return;let a=this.formatTimestamp(new Date),_=ue[e].padEnd(5),u=s.padEnd(6),l="";r?.correlationId?l=`[${r.correlationId}] `:r?.sessionId&&(l=`[session-${r.sessionId}] `);let E="";i!=null&&(this.getLevel()===0&&typeof i=="object"?E=`
`+JSON.stringify(i,null,2):E=" "+this.formatData(i));let b="";if(r){let{sessionId:f,sdkSessionId:M,correlationId:S,...p}=r;Object.keys(p).length>0&&(b=` {${Object.entries(p).map(([n,D])=>`${n}=${D}`).join(", ")}}`)}let I=`[${a}] [${_}] [${u}] ${l}${t}${b}${E}`;e===3?console.error(I):console.log(I)}debug(e,s,t,r){this.log(0,e,s,t,r)}info(e,s,t,r){this.log(1,e,s,t,r)}warn(e,s,t,r){this.log(2,e,s,t,r)}error(e,s,t,r){this.log(3,e,s,t,r)}dataIn(e,s,t,r){this.info(e,`\u2192 ${s}`,t,r)}dataOut(e,s,t,r){this.info(e,`\u2190 ${s}`,t,r)}success(e,s,t,r){this.info(e,`\u2713 ${s}`,t,r)}failure(e,s,t,r){this.error(e,`\u2717 ${s}`,t,r)}timing(e,s,t,r){this.info(e,`\u23F1 ${s}`,r,{duration:`${t}ms`})}happyPathError(e,s,t,r,i=""){let l=((new Error().stack||"").split(`
`)[2]||"").match(/at\s+(?:.*\s+)?\(?([^:]+):(\d+):(\d+)\)?/),E=l?`${l[1].split("/").pop()}:${l[2]}`:"unknown",b={...t,location:E};return this.warn(e,`[HAPPY-PATH] ${s}`,b,r),i}},y=new pe;var F=class{static DEFAULTS={CLAUDE_MEM_MODEL:"haiku",CLAUDE_MEM_LANGUAGE:"ja",CLAUDE_MEM_CONTEXT_OBSERVATIONS:"15",CLAUDE_MEM_WORKER_PORT:"37777",CLAUDE_MEM_WORKER_HOST:"127.0.0.1",CLAUDE_MEM_SKIP_TOOLS:"ListMcpResourcesTool,SlashCommand,Skill",CLAUDE_MEM_ALLOW_TOOLS:"Edit,Write,MultiEdit,TodoWrite,Bash,AskUserQuestion",CLAUDE_MEM_SDK_ENABLED:"true",CLAUDE_MEM_DATA_DIR:(0,Le.join)((0,Ce.homedir)(),".claude-mem"),CLAUDE_MEM_LOG_LEVEL:"INFO",CLAUDE_MEM_PYTHON_VERSION:"3.13",CLAUDE_CODE_PATH:"",CLAUDE_MEM_EMBEDDING_MODEL:"ruri",CLAUDE_MEM_EMBEDDING_PORT:"37778",CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS:"true",CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS:"true",CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT:"true",CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT:"true",CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES:Ae,CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS:Ie,CLAUDE_MEM_CONTEXT_FULL_COUNT:"3",CLAUDE_MEM_CONTEXT_FULL_FIELD:"narrative",CLAUDE_MEM_CONTEXT_SESSION_COUNT:"5",CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY:"true",CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE:"false",CLAUDE_MEM_CONTEXT_USER_PROMPTS_COUNT:"5",CLAUDE_MEM_CONTEXT_RAW_TOOL_COUNT:"10"};static getAllDefaults(){return{...this.DEFAULTS}}static get(e){return this.DEFAULTS[e]}static getInt(e){let s=this.get(e);return parseInt(s,10)}static getBool(e){return this.get(e)==="true"}static loadFromFile(e){try{if(!(0,V.existsSync)(e))return this.getAllDefaults();let s=(0,V.readFileSync)(e,"utf-8"),t=JSON.parse(s),r=t;if(t.env&&typeof t.env=="object"){r=t.env;try{(0,V.writeFileSync)(e,JSON.stringify(r,null,2),"utf-8"),y.info("SETTINGS","Migrated settings file from nested to flat schema",{settingsPath:e})}catch(a){y.warn("SETTINGS","Failed to auto-migrate settings file",{settingsPath:e},a)}}let i={...this.DEFAULTS};for(let a of Object.keys(this.DEFAULTS))r[a]!==void 0&&(i[a]=r[a]);return i}catch(s){return y.warn("SETTINGS","Failed to load settings, using defaults",{settingsPath:e},s),this.getAllDefaults()}}};var ze={};function Je(){return typeof __dirname<"u"?__dirname:(0,C.dirname)((0,ye.fileURLToPath)(ze.url))}var Qe=Je(),U=F.get("CLAUDE_MEM_DATA_DIR"),le=process.env.CLAUDE_CONFIG_DIR||(0,C.join)((0,De.homedir)(),".claude"),Ss=(0,C.join)(U,"archives"),bs=(0,C.join)(U,"logs"),fs=(0,C.join)(U,"trash"),Rs=(0,C.join)(U,"backups"),Os=(0,C.join)(U,"settings.json"),Me=(0,C.join)(U,"claude-mem.db"),Ns=(0,C.join)(U,"vector-db");var ke=(0,C.join)(Qe,"..",".."),As=(0,C.join)(le,"settings.json"),Is=(0,C.join)(le,"commands"),Ls=(0,C.join)(le,"CLAUDE.md");function $e(d){(0,ve.mkdirSync)(d,{recursive:!0})}var se=class{db;constructor(){$e(U),this.db=new Ue.Database(Me),this.db.run("PRAGMA journal_mode = WAL"),this.db.run("PRAGMA synchronous = NORMAL"),this.db.run("PRAGMA foreign_keys = ON"),this.initializeSchema(),this.ensureWorkerPortColumn(),this.ensurePromptTrackingColumns(),this.removeSessionSummariesUniqueConstraint(),this.addObservationHierarchicalFields(),this.makeObservationsTextNullable(),this.createUserPromptsTable(),this.ensureDiscoveryTokensColumn(),this.createPendingMessagesTable(),this.createRawToolResultsTable()}initializeSchema(){try{this.db.run(`
        CREATE TABLE IF NOT EXISTS schema_versions (
          id INTEGER PRIMARY KEY,
          version INTEGER UNIQUE NOT NULL,
          applied_at TEXT NOT NULL
        )
      `);let e=this.db.prepare("SELECT version FROM schema_versions ORDER BY version").all();(e.length>0?Math.max(...e.map(t=>t.version)):0)===0&&(console.log("[SessionStore] Initializing fresh database with migration004..."),this.db.run(`
          CREATE TABLE IF NOT EXISTS sdk_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            claude_session_id TEXT UNIQUE NOT NULL,
            sdk_session_id TEXT UNIQUE,
            project TEXT NOT NULL,
            user_prompt TEXT,
            started_at TEXT NOT NULL,
            started_at_epoch INTEGER NOT NULL,
            completed_at TEXT,
            completed_at_epoch INTEGER,
            status TEXT CHECK(status IN ('active', 'completed', 'failed')) NOT NULL DEFAULT 'active'
          );

          CREATE INDEX IF NOT EXISTS idx_sdk_sessions_claude_id ON sdk_sessions(claude_session_id);
          CREATE INDEX IF NOT EXISTS idx_sdk_sessions_sdk_id ON sdk_sessions(sdk_session_id);
          CREATE INDEX IF NOT EXISTS idx_sdk_sessions_project ON sdk_sessions(project);
          CREATE INDEX IF NOT EXISTS idx_sdk_sessions_status ON sdk_sessions(status);
          CREATE INDEX IF NOT EXISTS idx_sdk_sessions_started ON sdk_sessions(started_at_epoch DESC);

          CREATE TABLE IF NOT EXISTS observations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sdk_session_id TEXT NOT NULL,
            project TEXT NOT NULL,
            text TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('decision', 'bugfix', 'feature', 'refactor', 'discovery')),
            created_at TEXT NOT NULL,
            created_at_epoch INTEGER NOT NULL,
            FOREIGN KEY(sdk_session_id) REFERENCES sdk_sessions(sdk_session_id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_observations_sdk_session ON observations(sdk_session_id);
          CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project);
          CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
          CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(created_at_epoch DESC);

          CREATE TABLE IF NOT EXISTS session_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sdk_session_id TEXT UNIQUE NOT NULL,
            project TEXT NOT NULL,
            request TEXT,
            investigated TEXT,
            learned TEXT,
            completed TEXT,
            next_steps TEXT,
            files_read TEXT,
            files_edited TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            created_at_epoch INTEGER NOT NULL,
            FOREIGN KEY(sdk_session_id) REFERENCES sdk_sessions(sdk_session_id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_session_summaries_sdk_session ON session_summaries(sdk_session_id);
          CREATE INDEX IF NOT EXISTS idx_session_summaries_project ON session_summaries(project);
          CREATE INDEX IF NOT EXISTS idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
        `),this.db.prepare("INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)").run(4,new Date().toISOString()),console.log("[SessionStore] Migration004 applied successfully"))}catch(e){throw console.error("[SessionStore] Schema initialization error:",e.message),e}}ensureWorkerPortColumn(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(5))return;this.db.query("PRAGMA table_info(sdk_sessions)").all().some(r=>r.name==="worker_port")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN worker_port INTEGER"),console.log("[SessionStore] Added worker_port column to sdk_sessions table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(5,new Date().toISOString())}catch(e){console.error("[SessionStore] Migration error:",e.message)}}ensurePromptTrackingColumns(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(6))return;this.db.query("PRAGMA table_info(sdk_sessions)").all().some(u=>u.name==="prompt_counter")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN prompt_counter INTEGER DEFAULT 0"),console.log("[SessionStore] Added prompt_counter column to sdk_sessions table")),this.db.query("PRAGMA table_info(observations)").all().some(u=>u.name==="prompt_number")||(this.db.run("ALTER TABLE observations ADD COLUMN prompt_number INTEGER"),console.log("[SessionStore] Added prompt_number column to observations table")),this.db.query("PRAGMA table_info(session_summaries)").all().some(u=>u.name==="prompt_number")||(this.db.run("ALTER TABLE session_summaries ADD COLUMN prompt_number INTEGER"),console.log("[SessionStore] Added prompt_number column to session_summaries table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(6,new Date().toISOString())}catch(e){console.error("[SessionStore] Prompt tracking migration error:",e.message)}}removeSessionSummariesUniqueConstraint(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(7))return;if(!this.db.query("PRAGMA index_list(session_summaries)").all().some(r=>r.unique===1)){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString());return}console.log("[SessionStore] Removing UNIQUE constraint from session_summaries.sdk_session_id..."),this.db.run("BEGIN TRANSACTION");try{this.db.run(`
          CREATE TABLE session_summaries_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sdk_session_id TEXT NOT NULL,
            project TEXT NOT NULL,
            request TEXT,
            investigated TEXT,
            learned TEXT,
            completed TEXT,
            next_steps TEXT,
            files_read TEXT,
            files_edited TEXT,
            notes TEXT,
            prompt_number INTEGER,
            created_at TEXT NOT NULL,
            created_at_epoch INTEGER NOT NULL,
            FOREIGN KEY(sdk_session_id) REFERENCES sdk_sessions(sdk_session_id) ON DELETE CASCADE
          )
        `),this.db.run(`
          INSERT INTO session_summaries_new
          SELECT id, sdk_session_id, project, request, investigated, learned,
                 completed, next_steps, files_read, files_edited, notes,
                 prompt_number, created_at, created_at_epoch
          FROM session_summaries
        `),this.db.run("DROP TABLE session_summaries"),this.db.run("ALTER TABLE session_summaries_new RENAME TO session_summaries"),this.db.run(`
          CREATE INDEX idx_session_summaries_sdk_session ON session_summaries(sdk_session_id);
          CREATE INDEX idx_session_summaries_project ON session_summaries(project);
          CREATE INDEX idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
        `),this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString()),console.log("[SessionStore] Successfully removed UNIQUE constraint from session_summaries.sdk_session_id")}catch(r){throw this.db.run("ROLLBACK"),r}}catch(e){console.error("[SessionStore] Migration error (remove UNIQUE constraint):",e.message)}}addObservationHierarchicalFields(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(8))return;if(this.db.query("PRAGMA table_info(observations)").all().some(r=>r.name==="title")){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString());return}console.log("[SessionStore] Adding hierarchical fields to observations table..."),this.db.run(`
        ALTER TABLE observations ADD COLUMN title TEXT;
        ALTER TABLE observations ADD COLUMN subtitle TEXT;
        ALTER TABLE observations ADD COLUMN facts TEXT;
        ALTER TABLE observations ADD COLUMN narrative TEXT;
        ALTER TABLE observations ADD COLUMN concepts TEXT;
        ALTER TABLE observations ADD COLUMN files_read TEXT;
        ALTER TABLE observations ADD COLUMN files_modified TEXT;
      `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString()),console.log("[SessionStore] Successfully added hierarchical fields to observations table")}catch(e){console.error("[SessionStore] Migration error (add hierarchical fields):",e.message)}}makeObservationsTextNullable(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(9))return;let t=this.db.query("PRAGMA table_info(observations)").all().find(r=>r.name==="text");if(!t||t.notnull===0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString());return}console.log("[SessionStore] Making observations.text nullable..."),this.db.run("BEGIN TRANSACTION");try{this.db.run(`
          CREATE TABLE observations_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sdk_session_id TEXT NOT NULL,
            project TEXT NOT NULL,
            text TEXT,
            type TEXT NOT NULL CHECK(type IN ('decision', 'bugfix', 'feature', 'refactor', 'discovery', 'change')),
            title TEXT,
            subtitle TEXT,
            facts TEXT,
            narrative TEXT,
            concepts TEXT,
            files_read TEXT,
            files_modified TEXT,
            prompt_number INTEGER,
            created_at TEXT NOT NULL,
            created_at_epoch INTEGER NOT NULL,
            FOREIGN KEY(sdk_session_id) REFERENCES sdk_sessions(sdk_session_id) ON DELETE CASCADE
          )
        `),this.db.run(`
          INSERT INTO observations_new
          SELECT id, sdk_session_id, project, text, type, title, subtitle, facts,
                 narrative, concepts, files_read, files_modified, prompt_number,
                 created_at, created_at_epoch
          FROM observations
        `),this.db.run("DROP TABLE observations"),this.db.run("ALTER TABLE observations_new RENAME TO observations"),this.db.run(`
          CREATE INDEX idx_observations_sdk_session ON observations(sdk_session_id);
          CREATE INDEX idx_observations_project ON observations(project);
          CREATE INDEX idx_observations_type ON observations(type);
          CREATE INDEX idx_observations_created ON observations(created_at_epoch DESC);
        `),this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString()),console.log("[SessionStore] Successfully made observations.text nullable")}catch(r){throw this.db.run("ROLLBACK"),r}}catch(e){console.error("[SessionStore] Migration error (make text nullable):",e.message)}}createUserPromptsTable(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(10))return;if(this.db.query("PRAGMA table_info(user_prompts)").all().length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString());return}console.log("[SessionStore] Creating user_prompts table with FTS5 support..."),this.db.run("BEGIN TRANSACTION");try{this.db.run(`
          CREATE TABLE user_prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            claude_session_id TEXT NOT NULL,
            prompt_number INTEGER NOT NULL,
            prompt_text TEXT NOT NULL,
            created_at TEXT NOT NULL,
            created_at_epoch INTEGER NOT NULL,
            FOREIGN KEY(claude_session_id) REFERENCES sdk_sessions(claude_session_id) ON DELETE CASCADE
          );

          CREATE INDEX idx_user_prompts_claude_session ON user_prompts(claude_session_id);
          CREATE INDEX idx_user_prompts_created ON user_prompts(created_at_epoch DESC);
          CREATE INDEX idx_user_prompts_prompt_number ON user_prompts(prompt_number);
          CREATE INDEX idx_user_prompts_lookup ON user_prompts(claude_session_id, prompt_number);
        `),this.db.run(`
          CREATE VIRTUAL TABLE user_prompts_fts USING fts5(
            prompt_text,
            content='user_prompts',
            content_rowid='id'
          );
        `),this.db.run(`
          CREATE TRIGGER user_prompts_ai AFTER INSERT ON user_prompts BEGIN
            INSERT INTO user_prompts_fts(rowid, prompt_text)
            VALUES (new.id, new.prompt_text);
          END;

          CREATE TRIGGER user_prompts_ad AFTER DELETE ON user_prompts BEGIN
            INSERT INTO user_prompts_fts(user_prompts_fts, rowid, prompt_text)
            VALUES('delete', old.id, old.prompt_text);
          END;

          CREATE TRIGGER user_prompts_au AFTER UPDATE ON user_prompts BEGIN
            INSERT INTO user_prompts_fts(user_prompts_fts, rowid, prompt_text)
            VALUES('delete', old.id, old.prompt_text);
            INSERT INTO user_prompts_fts(rowid, prompt_text)
            VALUES (new.id, new.prompt_text);
          END;
        `),this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString()),console.log("[SessionStore] Successfully created user_prompts table with FTS5 support")}catch(t){throw this.db.run("ROLLBACK"),t}}catch(e){console.error("[SessionStore] Migration error (create user_prompts table):",e.message)}}ensureDiscoveryTokensColumn(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(11))return;this.db.query("PRAGMA table_info(observations)").all().some(a=>a.name==="discovery_tokens")||(this.db.run("ALTER TABLE observations ADD COLUMN discovery_tokens INTEGER DEFAULT 0"),console.log("[SessionStore] Added discovery_tokens column to observations table")),this.db.query("PRAGMA table_info(session_summaries)").all().some(a=>a.name==="discovery_tokens")||(this.db.run("ALTER TABLE session_summaries ADD COLUMN discovery_tokens INTEGER DEFAULT 0"),console.log("[SessionStore] Added discovery_tokens column to session_summaries table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(11,new Date().toISOString())}catch(e){throw console.error("[SessionStore] Discovery tokens migration error:",e.message),e}}createPendingMessagesTable(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(16))return;if(this.db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='pending_messages'").all().length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(16,new Date().toISOString());return}console.log("[SessionStore] Creating pending_messages table..."),this.db.run(`
        CREATE TABLE pending_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_db_id INTEGER NOT NULL,
          claude_session_id TEXT NOT NULL,
          message_type TEXT NOT NULL CHECK(message_type IN ('observation', 'summarize')),
          tool_name TEXT,
          tool_input TEXT,
          tool_response TEXT,
          cwd TEXT,
          last_user_message TEXT,
          last_assistant_message TEXT,
          prompt_number INTEGER,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'processed', 'failed')),
          retry_count INTEGER NOT NULL DEFAULT 0,
          created_at_epoch INTEGER NOT NULL,
          started_processing_at_epoch INTEGER,
          completed_at_epoch INTEGER,
          FOREIGN KEY (session_db_id) REFERENCES sdk_sessions(id) ON DELETE CASCADE
        )
      `),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_session ON pending_messages(session_db_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_status ON pending_messages(status)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_claude_session ON pending_messages(claude_session_id)"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(16,new Date().toISOString()),console.log("[SessionStore] pending_messages table created successfully")}catch(e){throw console.error("[SessionStore] Pending messages table migration error:",e.message),e}}createRawToolResultsTable(){try{if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(17))return;if(this.db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='raw_tool_results'").all().length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(17,new Date().toISOString());return}console.log("[SessionStore] Creating raw_tool_results table..."),this.db.run(`
        CREATE TABLE raw_tool_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          tool_name TEXT NOT NULL,
          tool_input TEXT,
          tool_result TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `),this.db.run("CREATE INDEX IF NOT EXISTS idx_raw_tool_results_session ON raw_tool_results(session_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_raw_tool_results_tool ON raw_tool_results(tool_name)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_raw_tool_results_created ON raw_tool_results(created_at)"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(17,new Date().toISOString()),console.log("[SessionStore] raw_tool_results table created successfully")}catch(e){throw console.error("[SessionStore] Raw tool results table migration error:",e.message),e}}getRecentSummaries(e,s=10){return this.db.prepare(`
      SELECT
        request, investigated, learned, completed, next_steps,
        files_read, files_edited, notes, prompt_number, created_at
      FROM session_summaries
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,s)}getRecentSummariesWithSessionInfo(e,s=3){return this.db.prepare(`
      SELECT
        sdk_session_id, request, learned, completed, next_steps,
        prompt_number, created_at
      FROM session_summaries
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,s)}getRecentObservations(e,s=20){return this.db.prepare(`
      SELECT type, text, prompt_number, created_at
      FROM observations
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,s)}getAllRecentObservations(e=100){return this.db.prepare(`
      SELECT id, type, title, subtitle, text, project, prompt_number, created_at, created_at_epoch
      FROM observations
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e)}getAllRecentSummaries(e=50){return this.db.prepare(`
      SELECT id, request, investigated, learned, completed, next_steps,
             files_read, files_edited, notes, project, prompt_number,
             created_at, created_at_epoch
      FROM session_summaries
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e)}getAllRecentUserPrompts(e=100){return this.db.prepare(`
      SELECT
        up.id,
        up.claude_session_id,
        s.project,
        up.prompt_number,
        up.prompt_text,
        up.created_at,
        up.created_at_epoch
      FROM user_prompts up
      LEFT JOIN sdk_sessions s ON up.claude_session_id = s.claude_session_id
      ORDER BY up.created_at_epoch DESC
      LIMIT ?
    `).all(e)}getAllProjects(){return this.db.prepare(`
      SELECT DISTINCT project
      FROM sdk_sessions
      WHERE project IS NOT NULL AND project != ''
      ORDER BY project ASC
    `).all().map(t=>t.project)}getLatestUserPrompt(e){return this.db.prepare(`
      SELECT
        up.*,
        s.sdk_session_id,
        s.project
      FROM user_prompts up
      JOIN sdk_sessions s ON up.claude_session_id = s.claude_session_id
      WHERE up.claude_session_id = ?
      ORDER BY up.created_at_epoch DESC
      LIMIT 1
    `).get(e)}getRecentSessionsWithStatus(e,s=3){return this.db.prepare(`
      SELECT * FROM (
        SELECT
          s.sdk_session_id,
          s.status,
          s.started_at,
          s.started_at_epoch,
          s.user_prompt,
          CASE WHEN sum.sdk_session_id IS NOT NULL THEN 1 ELSE 0 END as has_summary
        FROM sdk_sessions s
        LEFT JOIN session_summaries sum ON s.sdk_session_id = sum.sdk_session_id
        WHERE s.project = ? AND s.sdk_session_id IS NOT NULL
        GROUP BY s.sdk_session_id
        ORDER BY s.started_at_epoch DESC
        LIMIT ?
      )
      ORDER BY started_at_epoch ASC
    `).all(e,s)}getMostRecentProject(){return this.db.prepare(`
      SELECT project
      FROM sdk_sessions
      WHERE project IS NOT NULL AND project != ''
      ORDER BY started_at_epoch DESC
      LIMIT 1
    `).get()?.project||null}getObservationsForSession(e){return this.db.prepare(`
      SELECT title, subtitle, type, prompt_number
      FROM observations
      WHERE sdk_session_id = ?
      ORDER BY created_at_epoch ASC
    `).all(e)}getObservationById(e){return this.db.prepare(`
      SELECT *
      FROM observations
      WHERE id = ?
    `).get(e)||null}getObservationsByIds(e,s={}){if(e.length===0)return[];let{orderBy:t="date_desc",limit:r,project:i,type:a,concepts:_,files:u}=s,l=t==="date_asc"?"ASC":"DESC",E=r?`LIMIT ${r}`:"",b=e.map(()=>"?").join(","),I=[...e],f=[];if(i&&(f.push("project = ?"),I.push(i)),a)if(Array.isArray(a)){let p=a.map(()=>"?").join(",");f.push(`type IN (${p})`),I.push(...a)}else f.push("type = ?"),I.push(a);if(_){let p=Array.isArray(_)?_:[_],P=p.map(()=>"EXISTS (SELECT 1 FROM json_each(concepts) WHERE value = ?)");I.push(...p),f.push(`(${P.join(" OR ")})`)}if(u){let p=Array.isArray(u)?u:[u],P=p.map(()=>"(EXISTS (SELECT 1 FROM json_each(files_read) WHERE value LIKE ?) OR EXISTS (SELECT 1 FROM json_each(files_modified) WHERE value LIKE ?))");p.forEach(n=>{I.push(`%${n}%`,`%${n}%`)}),f.push(`(${P.join(" OR ")})`)}let M=f.length>0?`WHERE id IN (${b}) AND ${f.join(" AND ")}`:`WHERE id IN (${b})`;return this.db.prepare(`
      SELECT *
      FROM observations
      ${M}
      ORDER BY created_at_epoch ${l}
      ${E}
    `).all(...I)}getSummaryForSession(e){return this.db.prepare(`
      SELECT
        request, investigated, learned, completed, next_steps,
        files_read, files_edited, notes, prompt_number, created_at
      FROM session_summaries
      WHERE sdk_session_id = ?
      ORDER BY created_at_epoch DESC
      LIMIT 1
    `).get(e)||null}getFilesForSession(e){let t=this.db.prepare(`
      SELECT files_read, files_modified
      FROM observations
      WHERE sdk_session_id = ?
    `).all(e),r=new Set,i=new Set;for(let a of t){if(a.files_read)try{let _=JSON.parse(a.files_read);Array.isArray(_)&&_.forEach(u=>r.add(u))}catch{}if(a.files_modified)try{let _=JSON.parse(a.files_modified);Array.isArray(_)&&_.forEach(u=>i.add(u))}catch{}}return{filesRead:Array.from(r),filesModified:Array.from(i)}}getSessionById(e){return this.db.prepare(`
      SELECT id, claude_session_id, sdk_session_id, project, user_prompt
      FROM sdk_sessions
      WHERE id = ?
      LIMIT 1
    `).get(e)||null}getSdkSessionsBySessionIds(e){if(e.length===0)return[];let s=e.map(()=>"?").join(",");return this.db.prepare(`
      SELECT id, claude_session_id, sdk_session_id, project, user_prompt,
             started_at, started_at_epoch, completed_at, completed_at_epoch, status
      FROM sdk_sessions
      WHERE sdk_session_id IN (${s})
      ORDER BY started_at_epoch DESC
    `).all(...e)}findActiveSDKSession(e){return this.db.prepare(`
      SELECT id, sdk_session_id, project, worker_port
      FROM sdk_sessions
      WHERE claude_session_id = ? AND status = 'active'
      LIMIT 1
    `).get(e)||null}findAnySDKSession(e){return this.db.prepare(`
      SELECT id
      FROM sdk_sessions
      WHERE claude_session_id = ?
      LIMIT 1
    `).get(e)||null}reactivateSession(e,s){this.db.prepare(`
      UPDATE sdk_sessions
      SET status = 'active', user_prompt = ?, worker_port = NULL
      WHERE id = ?
    `).run(s,e)}incrementPromptCounter(e){return this.db.prepare(`
      UPDATE sdk_sessions
      SET prompt_counter = COALESCE(prompt_counter, 0) + 1
      WHERE id = ?
    `).run(e),this.db.prepare(`
      SELECT prompt_counter FROM sdk_sessions WHERE id = ?
    `).get(e)?.prompt_counter||1}getPromptCounter(e){return this.db.prepare(`
      SELECT prompt_counter FROM sdk_sessions WHERE id = ?
    `).get(e)?.prompt_counter||0}createSDKSession(e,s,t){let r=new Date,i=r.getTime(),_=this.db.prepare(`
      INSERT OR IGNORE INTO sdk_sessions
      (claude_session_id, sdk_session_id, project, user_prompt, started_at, started_at_epoch, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(e,e,s,t,r.toISOString(),i);return _.lastInsertRowid===0||_.changes===0?(s&&s.trim()!==""&&this.db.prepare(`
          UPDATE sdk_sessions
          SET project = ?, user_prompt = ?
          WHERE claude_session_id = ?
        `).run(s,t,e),this.db.prepare(`
        SELECT id FROM sdk_sessions WHERE claude_session_id = ? LIMIT 1
      `).get(e).id):_.lastInsertRowid}updateSDKSessionId(e,s){return this.db.prepare(`
      UPDATE sdk_sessions
      SET sdk_session_id = ?
      WHERE id = ? AND sdk_session_id IS NULL
    `).run(s,e).changes===0?(y.debug("DB","sdk_session_id already set, skipping update",{sessionId:e,sdkSessionId:s}),!1):!0}setWorkerPort(e,s){this.db.prepare(`
      UPDATE sdk_sessions
      SET worker_port = ?
      WHERE id = ?
    `).run(s,e)}getWorkerPort(e){return this.db.prepare(`
      SELECT worker_port
      FROM sdk_sessions
      WHERE id = ?
      LIMIT 1
    `).get(e)?.worker_port||null}saveUserPrompt(e,s,t){let r=new Date,i=r.getTime();return this.db.prepare(`
      INSERT INTO user_prompts
      (claude_session_id, prompt_number, prompt_text, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?)
    `).run(e,s,t,r.toISOString(),i).lastInsertRowid}getUserPrompt(e,s){return this.db.prepare(`
      SELECT prompt_text
      FROM user_prompts
      WHERE claude_session_id = ? AND prompt_number = ?
      LIMIT 1
    `).get(e,s)?.prompt_text??null}storeObservation(e,s,t,r,i=0){let a=new Date,_=a.getTime();this.db.prepare(`
      SELECT id FROM sdk_sessions WHERE sdk_session_id = ?
    `).get(e)||(this.db.prepare(`
        INSERT INTO sdk_sessions
        (claude_session_id, sdk_session_id, project, started_at, started_at_epoch, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(e,e,s,a.toISOString(),_),console.log(`[SessionStore] Auto-created session record for session_id: ${e}`));let b=this.db.prepare(`
      INSERT INTO observations
      (sdk_session_id, project, type, title, subtitle, facts, narrative, concepts,
       files_read, files_modified, prompt_number, discovery_tokens, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,s,t.type,t.title,t.subtitle,JSON.stringify(t.facts),t.narrative,JSON.stringify(t.concepts),JSON.stringify(t.files_read),JSON.stringify(t.files_modified),r||null,i,a.toISOString(),_);return{id:Number(b.lastInsertRowid),createdAtEpoch:_}}storeSummary(e,s,t,r,i=0){let a=new Date,_=a.getTime();this.db.prepare(`
      SELECT id FROM sdk_sessions WHERE sdk_session_id = ?
    `).get(e)||(this.db.prepare(`
        INSERT INTO sdk_sessions
        (claude_session_id, sdk_session_id, project, started_at, started_at_epoch, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(e,e,s,a.toISOString(),_),console.log(`[SessionStore] Auto-created session record for session_id: ${e}`));let b=this.db.prepare(`
      INSERT INTO session_summaries
      (sdk_session_id, project, request, investigated, learned, completed,
       next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,s,t.request,t.investigated,t.learned,t.completed,t.next_steps,t.notes,r||null,i,a.toISOString(),_);return{id:Number(b.lastInsertRowid),createdAtEpoch:_}}markSessionCompleted(e){let s=new Date,t=s.getTime();this.db.prepare(`
      UPDATE sdk_sessions
      SET status = 'completed', completed_at = ?, completed_at_epoch = ?
      WHERE id = ?
    `).run(s.toISOString(),t,e)}markSessionFailed(e){let s=new Date,t=s.getTime();this.db.prepare(`
      UPDATE sdk_sessions
      SET status = 'failed', completed_at = ?, completed_at_epoch = ?
      WHERE id = ?
    `).run(s.toISOString(),t,e)}getSessionSummariesByIds(e,s={}){if(e.length===0)return[];let{orderBy:t="date_desc",limit:r,project:i}=s,a=t==="date_asc"?"ASC":"DESC",_=r?`LIMIT ${r}`:"",u=e.map(()=>"?").join(","),l=[...e],E=i?`WHERE id IN (${u}) AND project = ?`:`WHERE id IN (${u})`;return i&&l.push(i),this.db.prepare(`
      SELECT * FROM session_summaries
      ${E}
      ORDER BY created_at_epoch ${a}
      ${_}
    `).all(...l)}getUserPromptsByIds(e,s={}){if(e.length===0)return[];let{orderBy:t="date_desc",limit:r,project:i}=s,a=t==="date_asc"?"ASC":"DESC",_=r?`LIMIT ${r}`:"",u=e.map(()=>"?").join(","),l=[...e],E=i?"AND s.project = ?":"";return i&&l.push(i),this.db.prepare(`
      SELECT
        up.*,
        s.project,
        s.sdk_session_id
      FROM user_prompts up
      JOIN sdk_sessions s ON up.claude_session_id = s.claude_session_id
      WHERE up.id IN (${u}) ${E}
      ORDER BY up.created_at_epoch ${a}
      ${_}
    `).all(...l)}getTimelineAroundTimestamp(e,s=10,t=10,r){return this.getTimelineAroundObservation(null,e,s,t,r)}getTimelineAroundObservation(e,s,t=10,r=10,i){let a=i?"AND project = ?":"",_=i?[i]:[],u,l;if(e!==null){let f=`
        SELECT id, created_at_epoch
        FROM observations
        WHERE id <= ? ${a}
        ORDER BY id DESC
        LIMIT ?
      `,M=`
        SELECT id, created_at_epoch
        FROM observations
        WHERE id >= ? ${a}
        ORDER BY id ASC
        LIMIT ?
      `;try{let S=this.db.prepare(f).all(e,..._,t+1),p=this.db.prepare(M).all(e,..._,r+1);if(S.length===0&&p.length===0)return{observations:[],sessions:[],prompts:[]};u=S.length>0?S[S.length-1].created_at_epoch:s,l=p.length>0?p[p.length-1].created_at_epoch:s}catch(S){return console.error("[SessionStore] Error getting boundary observations:",S.message,i?`(project: ${i})`:"(all projects)"),{observations:[],sessions:[],prompts:[]}}}else{let f=`
        SELECT created_at_epoch
        FROM observations
        WHERE created_at_epoch <= ? ${a}
        ORDER BY created_at_epoch DESC
        LIMIT ?
      `,M=`
        SELECT created_at_epoch
        FROM observations
        WHERE created_at_epoch >= ? ${a}
        ORDER BY created_at_epoch ASC
        LIMIT ?
      `;try{let S=this.db.prepare(f).all(s,..._,t),p=this.db.prepare(M).all(s,..._,r+1);if(S.length===0&&p.length===0)return{observations:[],sessions:[],prompts:[]};u=S.length>0?S[S.length-1].created_at_epoch:s,l=p.length>0?p[p.length-1].created_at_epoch:s}catch(S){return console.error("[SessionStore] Error getting boundary timestamps:",S.message,i?`(project: ${i})`:"(all projects)"),{observations:[],sessions:[],prompts:[]}}}let E=`
      SELECT *
      FROM observations
      WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${a}
      ORDER BY created_at_epoch ASC
    `,b=`
      SELECT *
      FROM session_summaries
      WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${a}
      ORDER BY created_at_epoch ASC
    `,I=`
      SELECT up.*, s.project, s.sdk_session_id
      FROM user_prompts up
      JOIN sdk_sessions s ON up.claude_session_id = s.claude_session_id
      WHERE up.created_at_epoch >= ? AND up.created_at_epoch <= ? ${a.replace("project","s.project")}
      ORDER BY up.created_at_epoch ASC
    `;try{let f=this.db.prepare(E).all(u,l,..._),M=this.db.prepare(b).all(u,l,..._),S=this.db.prepare(I).all(u,l,..._);return{observations:f,sessions:M.map(p=>({id:p.id,sdk_session_id:p.sdk_session_id,project:p.project,request:p.request,completed:p.completed,next_steps:p.next_steps,created_at:p.created_at,created_at_epoch:p.created_at_epoch})),prompts:S.map(p=>({id:p.id,claude_session_id:p.claude_session_id,prompt_number:p.prompt_number,prompt_text:p.prompt_text,project:p.project,created_at:p.created_at,created_at_epoch:p.created_at_epoch}))}}catch(f){return console.error("[SessionStore] Error querying timeline records:",f.message,i?`(project: ${i})`:"(all projects)"),{observations:[],sessions:[],prompts:[]}}}getPromptById(e){return this.db.prepare(`
      SELECT
        p.id,
        p.claude_session_id,
        p.prompt_number,
        p.prompt_text,
        s.project,
        p.created_at,
        p.created_at_epoch
      FROM user_prompts p
      LEFT JOIN sdk_sessions s ON p.claude_session_id = s.claude_session_id
      WHERE p.id = ?
      LIMIT 1
    `).get(e)||null}getPromptsByIds(e){if(e.length===0)return[];let s=e.map(()=>"?").join(",");return this.db.prepare(`
      SELECT
        p.id,
        p.claude_session_id,
        p.prompt_number,
        p.prompt_text,
        s.project,
        p.created_at,
        p.created_at_epoch
      FROM user_prompts p
      LEFT JOIN sdk_sessions s ON p.claude_session_id = s.claude_session_id
      WHERE p.id IN (${s})
      ORDER BY p.created_at_epoch DESC
    `).all(...e)}getSessionSummaryById(e){return this.db.prepare(`
      SELECT
        id,
        sdk_session_id,
        claude_session_id,
        project,
        user_prompt,
        request_summary,
        learned_summary,
        status,
        created_at,
        created_at_epoch
      FROM sdk_sessions
      WHERE id = ?
      LIMIT 1
    `).get(e)||null}close(){this.db.close()}importSdkSession(e){let s=this.db.prepare("SELECT id FROM sdk_sessions WHERE claude_session_id = ?").get(e.claude_session_id);return s?{imported:!1,id:s.id}:{imported:!0,id:this.db.prepare(`
      INSERT INTO sdk_sessions (
        claude_session_id, sdk_session_id, project, user_prompt,
        started_at, started_at_epoch, completed_at, completed_at_epoch, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e.claude_session_id,e.sdk_session_id,e.project,e.user_prompt,e.started_at,e.started_at_epoch,e.completed_at,e.completed_at_epoch,e.status).lastInsertRowid}}importSessionSummary(e){let s=this.db.prepare("SELECT id FROM session_summaries WHERE sdk_session_id = ?").get(e.sdk_session_id);return s?{imported:!1,id:s.id}:{imported:!0,id:this.db.prepare(`
      INSERT INTO session_summaries (
        sdk_session_id, project, request, investigated, learned,
        completed, next_steps, files_read, files_edited, notes,
        prompt_number, discovery_tokens, created_at, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e.sdk_session_id,e.project,e.request,e.investigated,e.learned,e.completed,e.next_steps,e.files_read,e.files_edited,e.notes,e.prompt_number,e.discovery_tokens||0,e.created_at,e.created_at_epoch).lastInsertRowid}}importObservation(e){let s=this.db.prepare(`
      SELECT id FROM observations
      WHERE sdk_session_id = ? AND title = ? AND created_at_epoch = ?
    `).get(e.sdk_session_id,e.title,e.created_at_epoch);return s?{imported:!1,id:s.id}:{imported:!0,id:this.db.prepare(`
      INSERT INTO observations (
        sdk_session_id, project, text, type, title, subtitle,
        facts, narrative, concepts, files_read, files_modified,
        prompt_number, discovery_tokens, created_at, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e.sdk_session_id,e.project,e.text,e.type,e.title,e.subtitle,e.facts,e.narrative,e.concepts,e.files_read,e.files_modified,e.prompt_number,e.discovery_tokens||0,e.created_at,e.created_at_epoch).lastInsertRowid}}importUserPrompt(e){let s=this.db.prepare(`
      SELECT id FROM user_prompts
      WHERE claude_session_id = ? AND prompt_number = ?
    `).get(e.claude_session_id,e.prompt_number);return s?{imported:!1,id:s.id}:{imported:!0,id:this.db.prepare(`
      INSERT INTO user_prompts (
        claude_session_id, prompt_number, prompt_text,
        created_at, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?)
    `).run(e.claude_session_id,e.prompt_number,e.prompt_text,e.created_at,e.created_at_epoch).lastInsertRowid}}saveRawToolResult(e,s,t,r){return this.db.prepare(`
      INSERT INTO raw_tool_results (session_id, tool_name, tool_input, tool_result)
      VALUES (?, ?, ?, ?)
    `).run(e,s,t,r).lastInsertRowid}saveClaudeResponse(e,s){return this.db.prepare(`
      INSERT INTO raw_tool_results (session_id, tool_name, tool_input, tool_result)
      VALUES (?, 'ClaudeResponse', '', ?)
    `).run(e,s).lastInsertRowid}getRecentRawToolResults(e,s=10){return this.db.prepare(`
      SELECT
        r.id,
        r.session_id,
        r.tool_name,
        r.tool_input,
        r.tool_result,
        r.created_at
      FROM raw_tool_results r
      JOIN sdk_sessions s ON r.session_id = s.claude_session_id
      WHERE s.project = ?
      ORDER BY r.created_at DESC
      LIMIT ?
    `).all(e,s)}};var me=de(require("path"),1);function Ee(d){if(!d)return[];try{let e=JSON.parse(d);return Array.isArray(e)?e:[]}catch{return[]}}function we(d){return new Date(d).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:!0})}function xe(d){return new Date(d).toLocaleString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0})}function Te(d){return new Date(d).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric"})}function te(d){let e=new Date(d),t=Math.floor((new Date().getTime()-e.getTime())/1e3);if(t<60)return"just now";let r=Math.floor(t/60);if(r<60)return`${r}m ago`;let i=Math.floor(r/60);if(i<24)return`${i}h ago`;let a=Math.floor(i/24);return a<30?`${a}d ago`:Te(d)}function Ze(d,e){return me.default.isAbsolute(d)?me.default.relative(e,d):d}function Fe(d,e){let s=Ee(d);return s.length>0?Ze(s[0],e):"General"}var Pe=de(require("path"),1);function Xe(d){if(!d||d.trim()==="")return y.warn("PROJECT_NAME","Empty cwd provided, using fallback",{cwd:d}),"unknown-project";let e=Pe.default.basename(d);if(e===""){if(process.platform==="win32"){let t=d.match(/^([A-Z]):\\/i);if(t){let i=`drive-${t[1].toUpperCase()}`;return y.info("PROJECT_NAME","Drive root detected",{cwd:d,projectName:i}),i}}return y.warn("PROJECT_NAME","Root directory detected, using fallback",{cwd:d}),"unknown-project"}return e}var es=ne.default.join(ke,"plugin",".install-version");function ss(){let d=ne.default.join((0,ge.homedir)(),".claude-mem","settings.json"),e=F.loadFromFile(d);try{return{totalObservationCount:parseInt(e.CLAUDE_MEM_CONTEXT_OBSERVATIONS,10),fullObservationCount:parseInt(e.CLAUDE_MEM_CONTEXT_FULL_COUNT,10),sessionCount:parseInt(e.CLAUDE_MEM_CONTEXT_SESSION_COUNT,10),userPromptsCount:parseInt(e.CLAUDE_MEM_CONTEXT_USER_PROMPTS_COUNT||"5",10),rawToolCount:parseInt(e.CLAUDE_MEM_CONTEXT_RAW_TOOL_COUNT||"10",10),showReadTokens:e.CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS==="true",showWorkTokens:e.CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS==="true",showSavingsAmount:e.CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT==="true",showSavingsPercent:e.CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT==="true",observationTypes:new Set(e.CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES.split(",").map(s=>s.trim()).filter(Boolean)),observationConcepts:new Set(e.CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS.split(",").map(s=>s.trim()).filter(Boolean)),fullObservationField:e.CLAUDE_MEM_CONTEXT_FULL_FIELD,showLastSummary:e.CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY==="true",showLastMessage:e.CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE==="true"}}catch(s){return y.warn("WORKER","Failed to load context settings, using defaults",{},s),{totalObservationCount:50,fullObservationCount:5,sessionCount:10,userPromptsCount:5,rawToolCount:10,showReadTokens:!0,showWorkTokens:!0,showSavingsAmount:!0,showSavingsPercent:!0,observationTypes:new Set(_e),observationConcepts:new Set(ce),fullObservationField:"narrative",showLastSummary:!0,showLastMessage:!1}}}var je=4,ts=1,o={reset:"\x1B[0m",bright:"\x1B[1m",dim:"\x1B[2m",cyan:"\x1B[36m",green:"\x1B[32m",yellow:"\x1B[33m",blue:"\x1B[34m",magenta:"\x1B[35m",gray:"\x1B[90m",red:"\x1B[31m"};function re(d,e,s,t){return e?t?[`${s}${d}:${o.reset} ${e}`,""]:[`**${d}**: ${e}`,""]:[]}function rs(d){return d.replace(/\//g,"-")}function ns(d){try{if(!(0,K.existsSync)(d))return{userMessage:"",assistantMessage:""};let e=(0,K.readFileSync)(d,"utf-8").trim();if(!e)return{userMessage:"",assistantMessage:""};let s=e.split(`
`).filter(r=>r.trim()),t="";for(let r=s.length-1;r>=0;r--)try{let i=s[r];if(!i.includes('"type":"assistant"'))continue;let a=JSON.parse(i);if(a.type==="assistant"&&a.message?.content&&Array.isArray(a.message.content)){let _="";for(let u of a.message.content)u.type==="text"&&(_+=u.text);if(_=_.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g,"").trim(),_){t=_;break}}}catch{continue}return{userMessage:"",assistantMessage:t}}catch(e){return y.failure("WORKER","Failed to extract prior messages from transcript",{transcriptPath:d},e),{userMessage:"",assistantMessage:""}}}async function os(d,e=!1){let s=ss(),t=d?.cwd??process.cwd(),r=Xe(t),i=null;try{i=new se}catch(D){if(D.code==="ERR_DLOPEN_FAILED"){try{(0,K.unlinkSync)(es)}catch{}return console.error("Native module rebuild needed - restart Claude Code to auto-fix"),""}throw D}let a=Array.from(s.observationTypes),_=a.map(()=>"?").join(","),u=Array.from(s.observationConcepts),l=u.map(()=>"?").join(","),E=i.db.prepare(`
    SELECT
      id, sdk_session_id, type, title, subtitle, narrative,
      facts, concepts, files_read, files_modified, discovery_tokens,
      created_at, created_at_epoch
    FROM observations
    WHERE project = ?
      AND type IN (${_})
      AND EXISTS (
        SELECT 1 FROM json_each(concepts)
        WHERE value IN (${l})
      )
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(r,...a,...u,s.totalObservationCount),b=i.db.prepare(`
    SELECT id, sdk_session_id, request, investigated, learned, completed, next_steps, created_at, created_at_epoch
    FROM session_summaries
    WHERE project = ?
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(r,s.sessionCount+ts),I=s.userPromptsCount>0?i.db.prepare(`
        SELECT
          up.id,
          up.claude_session_id,
          up.prompt_number,
          up.prompt_text,
          up.created_at,
          up.created_at_epoch,
          s.status as session_status,
          ss.completed as completed_summary
        FROM user_prompts up
        JOIN sdk_sessions s ON up.claude_session_id = s.claude_session_id
        LEFT JOIN session_summaries ss ON s.sdk_session_id = ss.sdk_session_id
        WHERE s.project = ?
        ORDER BY up.created_at_epoch DESC
        LIMIT ?
      `).all(r,s.userPromptsCount):[],f=s.rawToolCount>0?i.getRecentRawToolResults(r,s.rawToolCount):[],M="",S="";if(s.showLastMessage&&E.length>0)try{let D=d?.session_id,R=E.find(T=>T.sdk_session_id!==D);if(R){let T=R.sdk_session_id,g=rs(t),L=ne.default.join((0,ge.homedir)(),".claude","projects",g,`${T}.jsonl`),m=ns(L);M=m.userMessage,S=m.assistantMessage}}catch{}if(E.length===0&&b.length===0)return i?.close(),e?`
${o.bright}${o.cyan}[${r}] recent context${o.reset}
${o.gray}${"\u2500".repeat(60)}${o.reset}

${o.dim}No previous sessions found for this project yet.${o.reset}
`:`# [${r}] recent context

No previous sessions found for this project yet.`;let p=b.slice(0,s.sessionCount),P=E,n=[];if(e?(n.push(""),n.push(`${o.bright}${o.cyan}[${r}] recent context${o.reset}`),n.push(`${o.gray}${"\u2500".repeat(60)}${o.reset}`),n.push("")):(n.push(`# [${r}] recent context`),n.push("")),I.length>0){e?(n.push(`${o.bright}${o.yellow}\u{1F4DD} Recent Requests${o.reset}`),n.push("")):(n.push("## \u{1F4DD} Recent Requests"),n.push(""));let D=[...I].reverse();for(let R of D){let T=te(R.created_at),g=R.prompt_text.length>200?R.prompt_text.substring(0,200)+"...":R.prompt_text,L="";R.session_status==="completed"&&(L=e?`${o.green}(Done)${o.reset} `:"(Done) ");let m="";R.completed_summary&&(m=`
      \u2514\u2500 ${e?o.dim:""}Result: ${R.completed_summary}${e?o.reset:""}`),e?n.push(`${o.dim}${T}${o.reset} ${L}${g}${m}`):n.push(`- **${T}** ${L}${g}${m}`)}n.push("")}if(f.length>0){let D=f.filter(T=>T.tool_name==="TodoWrite");if(D.length>0){e?(n.push(`${o.bright}${o.magenta}\u{1F4CB} Recent Todo Changes${o.reset}`),n.push("")):(n.push("## \u{1F4CB} Recent Todo Changes"),n.push(""));let T=[...D].reverse();for(let g of T){let L=te(g.created_at),m="";try{if(g.tool_input){let v=JSON.parse(g.tool_input);if(v.todos&&Array.isArray(v.todos)){let B=v.todos.filter(A=>A.status==="in_progress"),q=v.todos.filter(A=>A.status==="pending"),J=v.todos.filter(A=>A.status==="completed"),$=[];B.length>0&&$.push(`\u{1F504} ${B.length} in progress`),q.length>0&&$.push(`\u23F3 ${q.length} pending`),J.length>0&&$.push(`\u2705 ${J.length} completed`),m=$.join(", ");let X=B[0]||q[0];if(X&&X.content){let A=X.content.length>80?X.content.substring(0,80)+"...":X.content;m+=` | "${A}"`}}}}catch{m="Todo list updated"}m||(m="Todo list updated"),e?n.push(`${o.dim}${L}${o.reset} ${m}`):n.push(`- **${L}** ${m}`)}n.push("")}let R=f.filter(T=>T.tool_name==="AskUserQuestion");if(R.length>0){e?(n.push(`${o.bright}${o.blue}\u2753 Recent User Questions${o.reset}`),n.push("")):(n.push("## \u2753 Recent User Questions"),n.push(""));let T=[...R].reverse();for(let g of T){let L=te(g.created_at),m="";try{if(g.tool_input){let v=JSON.parse(g.tool_input);v.question&&(m=`Q: ${v.question.length>100?v.question.substring(0,100)+"...":v.question}`)}if(g.tool_result){let v=g.tool_result.length>100?g.tool_result.substring(0,100)+"...":g.tool_result;m+=m?` \u2192 A: ${v}`:`A: ${v}`}}catch{m="User question"}m||(m="User question"),e?n.push(`${o.dim}${L}${o.reset} ${m}`):n.push(`- **${L}** ${m}`)}n.push("")}}if(P.length>0){e?n.push(`${o.dim}Legend: \u{1F3AF} session-request | \u{1F534} bugfix | \u{1F7E3} feature | \u{1F504} refactor | \u2705 change | \u{1F535} discovery | \u2696\uFE0F  decision${o.reset}`):n.push("**Legend:** \u{1F3AF} session-request | \u{1F534} bugfix | \u{1F7E3} feature | \u{1F504} refactor | \u2705 change | \u{1F535} discovery | \u2696\uFE0F  decision"),n.push(""),e?(n.push(`${o.bright}\u{1F4A1} Column Key${o.reset}`),n.push(`${o.dim}  Read: Tokens to read this observation (cost to learn it now)${o.reset}`),n.push(`${o.dim}  Work: Tokens spent on work that produced this record (\u{1F50D} research, \u{1F6E0}\uFE0F building, \u2696\uFE0F  deciding)${o.reset}`)):(n.push("\u{1F4A1} **Column Key**:"),n.push("- **Read**: Tokens to read this observation (cost to learn it now)"),n.push("- **Work**: Tokens spent on work that produced this record (\u{1F50D} research, \u{1F6E0}\uFE0F building, \u2696\uFE0F  deciding)")),n.push(""),e?(n.push(`${o.dim}\u{1F4A1} Context Index: This semantic index (titles, types, files, tokens) is usually sufficient to understand past work.${o.reset}`),n.push(""),n.push(`${o.dim}When you need implementation details, rationale, or debugging context:${o.reset}`),n.push(`${o.dim}  - Use the mem-search skill to fetch full observations on-demand${o.reset}`),n.push(`${o.dim}  - Critical types (\u{1F534} bugfix, \u2696\uFE0F decision) often need detailed fetching${o.reset}`),n.push(`${o.dim}  - Trust this index over re-reading code for past decisions and learnings${o.reset}`)):(n.push("\u{1F4A1} **Context Index:** This semantic index (titles, types, files, tokens) is usually sufficient to understand past work."),n.push(""),n.push("When you need implementation details, rationale, or debugging context:"),n.push("- Use the mem-search skill to fetch full observations on-demand"),n.push("- Critical types (\u{1F534} bugfix, \u2696\uFE0F decision) often need detailed fetching"),n.push("- Trust this index over re-reading code for past decisions and learnings")),n.push("");let D=E.length,R=E.reduce((c,O)=>{let N=(O.title?.length||0)+(O.subtitle?.length||0)+(O.narrative?.length||0)+JSON.stringify(O.facts||[]).length;return c+Math.ceil(N/je)},0),T=E.reduce((c,O)=>c+(O.discovery_tokens||0),0),g=T-R,L=T>0?Math.round(g/T*100):0,m=s.showReadTokens||s.showWorkTokens||s.showSavingsAmount||s.showSavingsPercent;if(m)if(e){if(n.push(`${o.bright}${o.cyan}\u{1F4CA} Context Economics${o.reset}`),n.push(`${o.dim}  Loading: ${D} observations (${R.toLocaleString()} tokens to read)${o.reset}`),n.push(`${o.dim}  Work investment: ${T.toLocaleString()} tokens spent on research, building, and decisions${o.reset}`),T>0&&(s.showSavingsAmount||s.showSavingsPercent)){let c="  Your savings: ";s.showSavingsAmount&&s.showSavingsPercent?c+=`${g.toLocaleString()} tokens (${L}% reduction from reuse)`:s.showSavingsAmount?c+=`${g.toLocaleString()} tokens`:c+=`${L}% reduction from reuse`,n.push(`${o.green}${c}${o.reset}`)}n.push("")}else{if(n.push("\u{1F4CA} **Context Economics**:"),n.push(`- Loading: ${D} observations (${R.toLocaleString()} tokens to read)`),n.push(`- Work investment: ${T.toLocaleString()} tokens spent on research, building, and decisions`),T>0&&(s.showSavingsAmount||s.showSavingsPercent)){let c="- Your savings: ";s.showSavingsAmount&&s.showSavingsPercent?c+=`${g.toLocaleString()} tokens (${L}% reduction from reuse)`:s.showSavingsAmount?c+=`${g.toLocaleString()} tokens`:c+=`${L}% reduction from reuse`,n.push(c)}n.push("")}let v=b[0]?.id,B=p.map((c,O)=>{let N=O===0?null:b[O+1];return{...c,displayEpoch:N?N.created_at_epoch:c.created_at_epoch,displayTime:N?N.created_at:c.created_at,shouldShowLink:c.id!==v}}),q=new Set(E.slice(0,s.fullObservationCount).map(c=>c.id)),J=[...P.map(c=>({type:"observation",data:c})),...B.map(c=>({type:"summary",data:c}))];J.sort((c,O)=>{let N=c.type==="observation"?c.data.created_at_epoch:c.data.displayEpoch,w=O.type==="observation"?O.data.created_at_epoch:O.data.displayEpoch;return N-w});let $=new Map;for(let c of J){let O=c.type==="observation"?c.data.created_at:c.data.displayTime,N=Te(O);$.has(N)||$.set(N,[]),$.get(N).push(c)}let X=Array.from($.entries()).sort((c,O)=>{let N=new Date(c[0]).getTime(),w=new Date(O[0]).getTime();return N-w});for(let[c,O]of X){e?(n.push(`${o.bright}${o.cyan}${c}${o.reset}`),n.push("")):(n.push(`### ${c}`),n.push(""));let N=null,w="",j=!1;for(let oe of O)if(oe.type==="summary"){j&&(n.push(""),j=!1,N=null,w="");let h=oe.data,W=`${h.request||"Session started"} (${we(h.displayTime)})`;e?n.push(`\u{1F3AF} ${o.yellow}#S${h.id}${o.reset} ${W}`):n.push(`**\u{1F3AF} #S${h.id}** ${W}`),n.push("")}else{let h=oe.data,W=Fe(h.files_modified,t);W!==N&&(j&&n.push(""),e?n.push(`${o.dim}${W}${o.reset}`):n.push(`**${W}**`),e||(n.push("| ID | Time | T | Title | Read | Work |"),n.push("|----|------|---|-------|------|------|")),N=W,j=!0,w="");let H=xe(h.created_at),Q=h.title||"Untitled",z=Oe[h.type]||"\u2022",We=(h.title?.length||0)+(h.subtitle?.length||0)+(h.narrative?.length||0)+JSON.stringify(h.facts||[]).length,G=Math.ceil(We/je),Y=h.discovery_tokens||0,ie=Ne[h.type]||"\u{1F50D}",Se=Y>0?`${ie} ${Y.toLocaleString()}`:"-",ae=H!==w,be=ae?H:"";if(w=H,q.has(h.id)){let x=s.fullObservationField==="narrative"?h.narrative:h.facts?Ee(h.facts).join(`
`):null;if(e){let k=ae?`${o.dim}${H}${o.reset}`:" ".repeat(H.length),Z=s.showReadTokens&&G>0?`${o.dim}(~${G}t)${o.reset}`:"",fe=s.showWorkTokens&&Y>0?`${o.dim}(${ie} ${Y.toLocaleString()}t)${o.reset}`:"";n.push(`  ${o.dim}#${h.id}${o.reset}  ${k}  ${z}  ${o.bright}${Q}${o.reset}`),x&&n.push(`    ${o.dim}${x}${o.reset}`),(Z||fe)&&n.push(`    ${Z} ${fe}`),n.push("")}else{j&&(n.push(""),j=!1),n.push(`**#${h.id}** ${be||"\u2033"} ${z} **${Q}**`),x&&(n.push(""),n.push(x),n.push(""));let k=[];s.showReadTokens&&k.push(`Read: ~${G}`),s.showWorkTokens&&k.push(`Work: ${Se}`),k.length>0&&n.push(k.join(", ")),n.push(""),N=null}}else if(e){let x=ae?`${o.dim}${H}${o.reset}`:" ".repeat(H.length),k=s.showReadTokens&&G>0?`${o.dim}(~${G}t)${o.reset}`:"",Z=s.showWorkTokens&&Y>0?`${o.dim}(${ie} ${Y.toLocaleString()}t)${o.reset}`:"";n.push(`  ${o.dim}#${h.id}${o.reset}  ${x}  ${z}  ${Q} ${k} ${Z}`)}else{let x=s.showReadTokens?`~${G}`:"",k=s.showWorkTokens?Se:"";n.push(`| #${h.id} | ${be||"\u2033"} | ${z} | ${Q} | ${x} | ${k} |`)}}j&&n.push("")}let A=b[0],he=E[0];if(s.showLastSummary&&A&&(A.investigated||A.learned||A.completed||A.next_steps)&&(!he||A.created_at_epoch>he.created_at_epoch)&&(n.push(...re("Investigated",A.investigated,o.blue,e)),n.push(...re("Learned",A.learned,o.yellow,e)),n.push(...re("Completed",A.completed,o.green,e)),n.push(...re("Next Steps",A.next_steps,o.magenta,e))),S&&(n.push(""),n.push("---"),n.push(""),e?(n.push(`${o.bright}${o.magenta}\u{1F4CB} Previously${o.reset}`),n.push(""),n.push(`${o.dim}A: ${S}${o.reset}`)):(n.push("**\u{1F4CB} Previously**"),n.push(""),n.push(`A: ${S}`)),n.push("")),m&&T>0&&g>0){let c=Math.round(T/1e3);n.push(""),e?n.push(`${o.dim}\u{1F4B0} Access ${c}k tokens of past research & decisions for just ${R.toLocaleString()}t. Use the mem-search skill to access memories by ID instead of re-reading files.${o.reset}`):n.push(`\u{1F4B0} Access ${c}k tokens of past research & decisions for just ${R.toLocaleString()}t. Use the mem-search skill to access memories by ID instead of re-reading files.`)}}return i?.close(),n.join(`
`).trimEnd()}0&&(module.exports={generateContext});
