"use strict";var je=Object.create;var ee=Object.defineProperty;var We=Object.getOwnPropertyDescriptor;var He=Object.getOwnPropertyNames;var Be=Object.getPrototypeOf,Ge=Object.prototype.hasOwnProperty;var Ve=(d,e)=>{for(var s in e)ee(d,s,{get:e[s],enumerable:!0})},be=(d,e,s,t)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of He(e))!Ge.call(d,r)&&r!==s&&ee(d,r,{get:()=>e[r],enumerable:!(t=We(e,r))||t.enumerable});return d};var ae=(d,e,s)=>(s=d!=null?je(Be(d)):{},be(e||!d||!d.__esModule?ee(s,"default",{value:d,enumerable:!0}):s,d)),Ye=d=>be(ee({},"__esModule",{value:!0}),d);var ns={};Ve(ns,{generateContext:()=>rs});module.exports=Ye(ns);var ne=ae(require("path"),1),Te=require("os"),Y=require("fs");var ke=require("bun:sqlite");var C=require("path"),Le=require("os"),Ce=require("fs");var De=require("url");var V=require("fs"),Ae=require("path"),Ie=require("os");var de=["bugfix","feature","refactor","discovery","decision","change"],_e=["how-it-works","why-it-exists","what-changed","problem-solution","gotcha","pattern","trade-off"],fe={bugfix:"\u{1F534}",feature:"\u{1F7E3}",refactor:"\u{1F504}",change:"\u2705",discovery:"\u{1F535}",decision:"\u2696\uFE0F","session-request":"\u{1F3AF}"},Re={discovery:"\u{1F50D}",change:"\u{1F6E0}\uFE0F",feature:"\u{1F6E0}\uFE0F",bugfix:"\u{1F6E0}\uFE0F",refactor:"\u{1F6E0}\uFE0F",decision:"\u2696\uFE0F"},Oe=de.join(","),Ne=_e.join(",");var ce=(i=>(i[i.DEBUG=0]="DEBUG",i[i.INFO=1]="INFO",i[i.WARN=2]="WARN",i[i.ERROR=3]="ERROR",i[i.SILENT=4]="SILENT",i))(ce||{}),ue=class{level=null;useColor;constructor(){this.useColor=process.stdout.isTTY??!1}getLevel(){if(this.level===null){let e=F.get("CLAUDE_MEM_LOG_LEVEL").toUpperCase();this.level=ce[e]??1}return this.level}correlationId(e,s){return`obs-${e}-${s}`}sessionId(e){return`session-${e}`}formatData(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof e=="number"||typeof e=="boolean")return e.toString();if(typeof e=="object"){if(e instanceof Error)return this.getLevel()===0?`${e.message}
${e.stack}`:e.message;if(Array.isArray(e))return`[${e.length} items]`;let s=Object.keys(e);return s.length===0?"{}":s.length<=3?JSON.stringify(e):`{${s.length} keys: ${s.slice(0,3).join(", ")}...}`}return String(e)}formatTool(e,s){if(!s)return e;try{let t=typeof s=="string"?JSON.parse(s):s;if(e==="Bash"&&t.command)return`${e}(${t.command})`;if(t.file_path)return`${e}(${t.file_path})`;if(t.notebook_path)return`${e}(${t.notebook_path})`;if(e==="Glob"&&t.pattern)return`${e}(${t.pattern})`;if(e==="Grep"&&t.pattern)return`${e}(${t.pattern})`;if(t.url)return`${e}(${t.url})`;if(t.query)return`${e}(${t.query})`;if(e==="Task"){if(t.subagent_type)return`${e}(${t.subagent_type})`;if(t.description)return`${e}(${t.description})`}return e==="Skill"&&t.skill?`${e}(${t.skill})`:e==="LSP"&&t.operation?`${e}(${t.operation})`:e}catch{return e}}formatTimestamp(e){let s=e.getFullYear(),t=String(e.getMonth()+1).padStart(2,"0"),r=String(e.getDate()).padStart(2,"0"),i=String(e.getHours()).padStart(2,"0"),a=String(e.getMinutes()).padStart(2,"0"),_=String(e.getSeconds()).padStart(2,"0"),u=String(e.getMilliseconds()).padStart(3,"0");return`${s}-${t}-${r} ${i}:${a}:${_}.${u}`}log(e,s,t,r,i){if(e<this.getLevel())return;let a=this.formatTimestamp(new Date),_=ce[e].padEnd(5),u=s.padEnd(6),l="";r?.correlationId?l=`[${r.correlationId}] `:r?.sessionId&&(l=`[session-${r.sessionId}] `);let E="";i!=null&&(this.getLevel()===0&&typeof i=="object"?E=`
`+JSON.stringify(i,null,2):E=" "+this.formatData(i));let b="";if(r){let{sessionId:O,sdkSessionId:M,correlationId:S,...p}=r;Object.keys(p).length>0&&(b=` {${Object.entries(p).map(([o,D])=>`${o}=${D}`).join(", ")}}`)}let L=`[${a}] [${_}] [${u}] ${l}${t}${b}${E}`;e===3?console.error(L):console.log(L)}debug(e,s,t,r){this.log(0,e,s,t,r)}info(e,s,t,r){this.log(1,e,s,t,r)}warn(e,s,t,r){this.log(2,e,s,t,r)}error(e,s,t,r){this.log(3,e,s,t,r)}dataIn(e,s,t,r){this.info(e,`\u2192 ${s}`,t,r)}dataOut(e,s,t,r){this.info(e,`\u2190 ${s}`,t,r)}success(e,s,t,r){this.info(e,`\u2713 ${s}`,t,r)}failure(e,s,t,r){this.error(e,`\u2717 ${s}`,t,r)}timing(e,s,t,r){this.info(e,`\u23F1 ${s}`,r,{duration:`${t}ms`})}happyPathError(e,s,t,r,i=""){let l=((new Error().stack||"").split(`
`)[2]||"").match(/at\s+(?:.*\s+)?\(?([^:]+):(\d+):(\d+)\)?/),E=l?`${l[1].split("/").pop()}:${l[2]}`:"unknown",b={...t,location:E};return this.warn(e,`[HAPPY-PATH] ${s}`,b,r),i}},y=new ue;var F=class{static DEFAULTS={CLAUDE_MEM_MODEL:"haiku",CLAUDE_MEM_LANGUAGE:"ja",CLAUDE_MEM_CONTEXT_OBSERVATIONS:"15",CLAUDE_MEM_WORKER_PORT:"37777",CLAUDE_MEM_WORKER_HOST:"127.0.0.1",CLAUDE_MEM_SKIP_TOOLS:"ListMcpResourcesTool,SlashCommand,Skill",CLAUDE_MEM_ALLOW_TOOLS:"Edit,Write,MultiEdit,TodoWrite,Bash,AskUserQuestion",CLAUDE_MEM_SDK_ENABLED:"true",CLAUDE_MEM_DATA_DIR:(0,Ae.join)((0,Ie.homedir)(),".claude-mem"),CLAUDE_MEM_LOG_LEVEL:"INFO",CLAUDE_MEM_PYTHON_VERSION:"3.13",CLAUDE_CODE_PATH:"",CLAUDE_MEM_EMBEDDING_MODEL:"ruri",CLAUDE_MEM_EMBEDDING_PORT:"37778",CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS:"true",CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS:"true",CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT:"true",CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT:"true",CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES:Oe,CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS:Ne,CLAUDE_MEM_CONTEXT_FULL_COUNT:"3",CLAUDE_MEM_CONTEXT_FULL_FIELD:"narrative",CLAUDE_MEM_CONTEXT_SESSION_COUNT:"5",CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY:"true",CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE:"false",CLAUDE_MEM_CONTEXT_USER_PROMPTS_COUNT:"5",CLAUDE_MEM_CONTEXT_RAW_TOOL_COUNT:"10"};static getAllDefaults(){return{...this.DEFAULTS}}static get(e){return this.DEFAULTS[e]}static getInt(e){let s=this.get(e);return parseInt(s,10)}static getBool(e){return this.get(e)==="true"}static loadFromFile(e){try{if(!(0,V.existsSync)(e))return this.getAllDefaults();let s=(0,V.readFileSync)(e,"utf-8"),t=JSON.parse(s),r=t;if(t.env&&typeof t.env=="object"){r=t.env;try{(0,V.writeFileSync)(e,JSON.stringify(r,null,2),"utf-8"),y.info("SETTINGS","Migrated settings file from nested to flat schema",{settingsPath:e})}catch(a){y.warn("SETTINGS","Failed to auto-migrate settings file",{settingsPath:e},a)}}let i={...this.DEFAULTS};for(let a of Object.keys(this.DEFAULTS))r[a]!==void 0&&(i[a]=r[a]);return i}catch(s){return y.warn("SETTINGS","Failed to load settings, using defaults",{settingsPath:e},s),this.getAllDefaults()}}};var Je={};function qe(){return typeof __dirname<"u"?__dirname:(0,C.dirname)((0,De.fileURLToPath)(Je.url))}var Ke=qe(),x=F.get("CLAUDE_MEM_DATA_DIR"),pe=process.env.CLAUDE_CONFIG_DIR||(0,C.join)((0,Le.homedir)(),".claude"),gs=(0,C.join)(x,"archives"),hs=(0,C.join)(x,"logs"),Ss=(0,C.join)(x,"trash"),bs=(0,C.join)(x,"backups"),fs=(0,C.join)(x,"settings.json"),ve=(0,C.join)(x,"claude-mem.db"),Rs=(0,C.join)(x,"vector-db");var ye=(0,C.join)(Ke,"..",".."),Os=(0,C.join)(pe,"settings.json"),Ns=(0,C.join)(pe,"commands"),As=(0,C.join)(pe,"CLAUDE.md");function Me(d){(0,Ce.mkdirSync)(d,{recursive:!0})}var se=class{db;constructor(){Me(x),this.db=new ke.Database(ve),this.db.run("PRAGMA journal_mode = WAL"),this.db.run("PRAGMA synchronous = NORMAL"),this.db.run("PRAGMA foreign_keys = ON"),this.initializeSchema(),this.ensureWorkerPortColumn(),this.ensurePromptTrackingColumns(),this.removeSessionSummariesUniqueConstraint(),this.addObservationHierarchicalFields(),this.makeObservationsTextNullable(),this.createUserPromptsTable(),this.ensureDiscoveryTokensColumn(),this.createPendingMessagesTable(),this.createRawToolResultsTable()}initializeSchema(){try{this.db.run(`
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
    `).get(e)||null}getObservationsByIds(e,s={}){if(e.length===0)return[];let{orderBy:t="date_desc",limit:r,project:i,type:a,concepts:_,files:u}=s,l=t==="date_asc"?"ASC":"DESC",E=r?`LIMIT ${r}`:"",b=e.map(()=>"?").join(","),L=[...e],O=[];if(i&&(O.push("project = ?"),L.push(i)),a)if(Array.isArray(a)){let p=a.map(()=>"?").join(",");O.push(`type IN (${p})`),L.push(...a)}else O.push("type = ?"),L.push(a);if(_){let p=Array.isArray(_)?_:[_],X=p.map(()=>"EXISTS (SELECT 1 FROM json_each(concepts) WHERE value = ?)");L.push(...p),O.push(`(${X.join(" OR ")})`)}if(u){let p=Array.isArray(u)?u:[u],X=p.map(()=>"(EXISTS (SELECT 1 FROM json_each(files_read) WHERE value LIKE ?) OR EXISTS (SELECT 1 FROM json_each(files_modified) WHERE value LIKE ?))");p.forEach(o=>{L.push(`%${o}%`,`%${o}%`)}),O.push(`(${X.join(" OR ")})`)}let M=O.length>0?`WHERE id IN (${b}) AND ${O.join(" AND ")}`:`WHERE id IN (${b})`;return this.db.prepare(`
      SELECT *
      FROM observations
      ${M}
      ORDER BY created_at_epoch ${l}
      ${E}
    `).all(...L)}getSummaryForSession(e){return this.db.prepare(`
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
    `).all(...l)}getTimelineAroundTimestamp(e,s=10,t=10,r){return this.getTimelineAroundObservation(null,e,s,t,r)}getTimelineAroundObservation(e,s,t=10,r=10,i){let a=i?"AND project = ?":"",_=i?[i]:[],u,l;if(e!==null){let O=`
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
      `;try{let S=this.db.prepare(O).all(e,..._,t+1),p=this.db.prepare(M).all(e,..._,r+1);if(S.length===0&&p.length===0)return{observations:[],sessions:[],prompts:[]};u=S.length>0?S[S.length-1].created_at_epoch:s,l=p.length>0?p[p.length-1].created_at_epoch:s}catch(S){return console.error("[SessionStore] Error getting boundary observations:",S.message,i?`(project: ${i})`:"(all projects)"),{observations:[],sessions:[],prompts:[]}}}else{let O=`
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
      `;try{let S=this.db.prepare(O).all(s,..._,t),p=this.db.prepare(M).all(s,..._,r+1);if(S.length===0&&p.length===0)return{observations:[],sessions:[],prompts:[]};u=S.length>0?S[S.length-1].created_at_epoch:s,l=p.length>0?p[p.length-1].created_at_epoch:s}catch(S){return console.error("[SessionStore] Error getting boundary timestamps:",S.message,i?`(project: ${i})`:"(all projects)"),{observations:[],sessions:[],prompts:[]}}}let E=`
      SELECT *
      FROM observations
      WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${a}
      ORDER BY created_at_epoch ASC
    `,b=`
      SELECT *
      FROM session_summaries
      WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${a}
      ORDER BY created_at_epoch ASC
    `,L=`
      SELECT up.*, s.project, s.sdk_session_id
      FROM user_prompts up
      JOIN sdk_sessions s ON up.claude_session_id = s.claude_session_id
      WHERE up.created_at_epoch >= ? AND up.created_at_epoch <= ? ${a.replace("project","s.project")}
      ORDER BY up.created_at_epoch ASC
    `;try{let O=this.db.prepare(E).all(u,l,..._),M=this.db.prepare(b).all(u,l,..._),S=this.db.prepare(L).all(u,l,..._);return{observations:O,sessions:M.map(p=>({id:p.id,sdk_session_id:p.sdk_session_id,project:p.project,request:p.request,completed:p.completed,next_steps:p.next_steps,created_at:p.created_at,created_at_epoch:p.created_at_epoch})),prompts:S.map(p=>({id:p.id,claude_session_id:p.claude_session_id,prompt_number:p.prompt_number,prompt_text:p.prompt_text,project:p.project,created_at:p.created_at,created_at_epoch:p.created_at_epoch}))}}catch(O){return console.error("[SessionStore] Error querying timeline records:",O.message,i?`(project: ${i})`:"(all projects)"),{observations:[],sessions:[],prompts:[]}}}getPromptById(e){return this.db.prepare(`
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
    `).all(e,s)}};var le=ae(require("path"),1);function me(d){if(!d)return[];try{let e=JSON.parse(d);return Array.isArray(e)?e:[]}catch{return[]}}function $e(d){return new Date(d).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:!0})}function Ue(d){return new Date(d).toLocaleString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0})}function Ee(d){return new Date(d).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric"})}function te(d){let e=new Date(d),t=Math.floor((new Date().getTime()-e.getTime())/1e3);if(t<60)return"just now";let r=Math.floor(t/60);if(r<60)return`${r}m ago`;let i=Math.floor(r/60);if(i<24)return`${i}h ago`;let a=Math.floor(i/24);return a<30?`${a}d ago`:Ee(d)}function Qe(d,e){return le.default.isAbsolute(d)?le.default.relative(e,d):d}function xe(d,e){let s=me(d);return s.length>0?Qe(s[0],e):"General"}var we=ae(require("path"),1);function Pe(d){if(!d||d.trim()==="")return y.warn("PROJECT_NAME","Empty cwd provided, using fallback",{cwd:d}),"unknown-project";let e=we.default.basename(d);if(e===""){if(process.platform==="win32"){let t=d.match(/^([A-Z]):\\/i);if(t){let i=`drive-${t[1].toUpperCase()}`;return y.info("PROJECT_NAME","Drive root detected",{cwd:d,projectName:i}),i}}return y.warn("PROJECT_NAME","Root directory detected, using fallback",{cwd:d}),"unknown-project"}return e}var ze=ne.default.join(ye,"plugin",".install-version");function Ze(){let d=ne.default.join((0,Te.homedir)(),".claude-mem","settings.json"),e=F.loadFromFile(d);try{return{totalObservationCount:parseInt(e.CLAUDE_MEM_CONTEXT_OBSERVATIONS,10),fullObservationCount:parseInt(e.CLAUDE_MEM_CONTEXT_FULL_COUNT,10),sessionCount:parseInt(e.CLAUDE_MEM_CONTEXT_SESSION_COUNT,10),userPromptsCount:parseInt(e.CLAUDE_MEM_CONTEXT_USER_PROMPTS_COUNT||"5",10),rawToolCount:parseInt(e.CLAUDE_MEM_CONTEXT_RAW_TOOL_COUNT||"10",10),showReadTokens:e.CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS==="true",showWorkTokens:e.CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS==="true",showSavingsAmount:e.CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT==="true",showSavingsPercent:e.CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT==="true",observationTypes:new Set(e.CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES.split(",").map(s=>s.trim()).filter(Boolean)),observationConcepts:new Set(e.CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS.split(",").map(s=>s.trim()).filter(Boolean)),fullObservationField:e.CLAUDE_MEM_CONTEXT_FULL_FIELD,showLastSummary:e.CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY==="true",showLastMessage:e.CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE==="true"}}catch(s){return y.warn("WORKER","Failed to load context settings, using defaults",{},s),{totalObservationCount:50,fullObservationCount:5,sessionCount:10,userPromptsCount:5,rawToolCount:10,showReadTokens:!0,showWorkTokens:!0,showSavingsAmount:!0,showSavingsPercent:!0,observationTypes:new Set(de),observationConcepts:new Set(_e),fullObservationField:"narrative",showLastSummary:!0,showLastMessage:!1}}}var Fe=4,es=1,n={reset:"\x1B[0m",bright:"\x1B[1m",dim:"\x1B[2m",cyan:"\x1B[36m",green:"\x1B[32m",yellow:"\x1B[33m",blue:"\x1B[34m",magenta:"\x1B[35m",gray:"\x1B[90m",red:"\x1B[31m"};function re(d,e,s,t){return e?t?[`${s}${d}:${n.reset} ${e}`,""]:[`${d}:${e}`]:[]}function ss(d){return d.replace(/\//g,"-")}function ts(d){try{if(!(0,Y.existsSync)(d))return{userMessage:"",assistantMessage:""};let e=(0,Y.readFileSync)(d,"utf-8").trim();if(!e)return{userMessage:"",assistantMessage:""};let s=e.split(`
`).filter(r=>r.trim()),t="";for(let r=s.length-1;r>=0;r--)try{let i=s[r];if(!i.includes('"type":"assistant"'))continue;let a=JSON.parse(i);if(a.type==="assistant"&&a.message?.content&&Array.isArray(a.message.content)){let _="";for(let u of a.message.content)u.type==="text"&&(_+=u.text);if(_=_.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g,"").trim(),_){t=_;break}}}catch{continue}return{userMessage:"",assistantMessage:t}}catch(e){return y.failure("WORKER","Failed to extract prior messages from transcript",{transcriptPath:d},e),{userMessage:"",assistantMessage:""}}}async function rs(d,e=!1){let s=Ze(),t=d?.cwd??process.cwd(),r=Pe(t),i=null;try{i=new se}catch(D){if(D.code==="ERR_DLOPEN_FAILED"){try{(0,Y.unlinkSync)(ze)}catch{}return console.error("Native module rebuild needed - restart Claude Code to auto-fix"),""}throw D}let a=Array.from(s.observationTypes),_=a.map(()=>"?").join(","),u=Array.from(s.observationConcepts),l=u.map(()=>"?").join(","),E=i.db.prepare(`
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
  `).all(r,s.sessionCount+es),L=s.userPromptsCount>0?i.db.prepare(`
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
      `).all(r,s.userPromptsCount):[],O=s.rawToolCount>0?i.getRecentRawToolResults(r,s.rawToolCount):[],M="",S="";if(s.showLastMessage&&E.length>0)try{let D=d?.session_id,N=E.find(T=>T.sdk_session_id!==D);if(N){let T=N.sdk_session_id,f=ss(t),v=ne.default.join((0,Te.homedir)(),".claude","projects",f,`${T}.jsonl`),g=ts(v);M=g.userMessage,S=g.assistantMessage}}catch{}if(E.length===0&&b.length===0)return i?.close(),e?`
${n.bright}${n.cyan}[${r}] recent context${n.reset}
${n.gray}${"\u2500".repeat(60)}${n.reset}

${n.dim}No previous sessions found for this project yet.${n.reset}
`:"<claude-mem-context><notice>No previous sessions found for this project.</notice></claude-mem-context>";let p=b.slice(0,s.sessionCount),X=E,o=[];if(e?(o.push(""),o.push(`${n.bright}${n.cyan}[claude-mem] recent context${n.reset}`),o.push(`${n.dim}Auto-injected archive from previous sessions. NOT a new user request.${n.reset}`),o.push(`${n.gray}${"\u2500".repeat(60)}${n.reset}`),o.push("")):(o.push("<claude-mem-context>"),o.push("<notice>Auto-injected archive. NOT new requests. Historical reference only.</notice>"),o.push("")),L.length>0){e?(o.push(`${n.bright}${n.yellow}\u{1F4DD} Recent Requests${n.reset}`),o.push(`${n.dim}\u26A0\uFE0F These are ARCHIVED past requests from previous sessions, NOT new tasks.${n.reset}`),o.push(`${n.dim}   Prioritize session summaries above. Only reference these for historical context.${n.reset}`),o.push("")):o.push('<recent-requests hint="ARCHIVED past requests, NOT new tasks">');let D=[...L].reverse();for(let N of D){let T=te(N.created_at),f=N.prompt_text.length>200?N.prompt_text.substring(0,200)+"...":N.prompt_text,v=N.session_status==="completed"?"Done":"";if(e){let g=v?`${n.green}(${v})${n.reset} `:"",I="";N.completed_summary&&(I=`
      \u2514\u2500 ${n.dim}Result: ${N.completed_summary}${n.reset}`),o.push(`${n.dim}${T}${n.reset} ${g}${f}${I}`)}else o.push(`${T}|${v}|${f}`)}e||o.push("</recent-requests>"),o.push("")}if(O.length>0){let D=O.filter(T=>T.tool_name==="TodoWrite");if(D.length>0){e?(o.push(`${n.bright}${n.magenta}\u{1F4CB} Recent Todo Changes${n.reset}`),o.push("")):o.push("<todo-changes>");let T=[...D].reverse();for(let f of T){let v=te(f.created_at),g="";try{if(f.tool_input){let I=JSON.parse(f.tool_input);if(I.todos&&Array.isArray(I.todos)){let H=I.todos.filter(m=>m.status==="in_progress"),q=I.todos.filter(m=>m.status==="pending"),K=I.todos.filter(m=>m.status==="completed"),U=[];H.length>0&&U.push(`\u{1F504}${H.length}`),q.length>0&&U.push(`\u23F3${q.length}`),K.length>0&&U.push(`\u2705${K.length}`),g=U.join(" ");let j=H[0]||q[0];if(j&&j.content){let m=j.content.length>80?j.content.substring(0,80)+"...":j.content;g+=`|${m}`}}}}catch{g="updated"}g||(g="updated"),e?o.push(`${n.dim}${v}${n.reset} ${g}`):o.push(`${v}|${g}`)}e||o.push("</todo-changes>"),o.push("")}let N=O.filter(T=>T.tool_name==="AskUserQuestion");if(N.length>0){e?(o.push(`${n.bright}${n.blue}\u2753 Recent User Questions${n.reset}`),o.push("")):o.push("<user-questions>");let T=[...N].reverse();for(let f of T){let v=te(f.created_at),g="";try{if(f.tool_input){let I=JSON.parse(f.tool_input);I.question&&(g=`Q:${I.question.length>100?I.question.substring(0,100)+"...":I.question}`)}if(f.tool_result){let I=f.tool_result.length>100?f.tool_result.substring(0,100)+"...":f.tool_result;g+=g?`\u2192A:${I}`:`A:${I}`}}catch{g="question"}g||(g="question"),e?o.push(`${n.dim}${v}${n.reset} ${g}`):o.push(`${v}|${g}`)}e||o.push("</user-questions>"),o.push("")}}if(X.length>0){e?(o.push(`${n.dim}Legend: \u{1F3AF} session-request | \u{1F534} bugfix | \u{1F7E3} feature | \u{1F504} refactor | \u2705 change | \u{1F535} discovery | \u2696\uFE0F  decision${n.reset}`),o.push(""),o.push(`${n.bright}\u{1F4A1} Column Key${n.reset}`),o.push(`${n.dim}  Read: Tokens to read this observation (cost to learn it now)${n.reset}`),o.push(`${n.dim}  Work: Tokens spent on work that produced this record (\u{1F50D} research, \u{1F6E0}\uFE0F building, \u2696\uFE0F  deciding)${n.reset}`),o.push(""),o.push(`${n.dim}\u{1F4A1} Context Index: This semantic index (titles, types, files, tokens) is usually sufficient to understand past work.${n.reset}`),o.push(""),o.push(`${n.dim}When you need implementation details, rationale, or debugging context:${n.reset}`),o.push(`${n.dim}  - Use the mem-search skill to fetch full observations on-demand${n.reset}`),o.push(`${n.dim}  - Critical types (\u{1F534} bugfix, \u2696\uFE0F decision) often need detailed fetching${n.reset}`),o.push(`${n.dim}  - Trust this index over re-reading code for past decisions and learnings${n.reset}`),o.push("")):(o.push("<hint>Legend: \u{1F3AF}session|\u{1F534}bug|\u{1F7E3}feat|\u{1F504}refactor|\u2705change|\u{1F535}discovery|\u2696\uFE0Fdecision | r=read-tokens w=work-tokens | Use mem-search skill for full details</hint>"),o.push(""));let D=E.length,N=E.reduce((c,R)=>{let A=(R.title?.length||0)+(R.subtitle?.length||0)+(R.narrative?.length||0)+JSON.stringify(R.facts||[]).length;return c+Math.ceil(A/Fe)},0),T=E.reduce((c,R)=>c+(R.discovery_tokens||0),0),f=T-N,v=T>0?Math.round(f/T*100):0,g=s.showReadTokens||s.showWorkTokens||s.showSavingsAmount||s.showSavingsPercent;if(g)if(e){if(o.push(`${n.bright}${n.cyan}\u{1F4CA} Context Economics${n.reset}`),o.push(`${n.dim}  Loading: ${D} observations (${N.toLocaleString()} tokens to read)${n.reset}`),o.push(`${n.dim}  Work investment: ${T.toLocaleString()} tokens spent on research, building, and decisions${n.reset}`),T>0&&(s.showSavingsAmount||s.showSavingsPercent)){let c="  Your savings: ";s.showSavingsAmount&&s.showSavingsPercent?c+=`${f.toLocaleString()} tokens (${v}% reduction from reuse)`:s.showSavingsAmount?c+=`${f.toLocaleString()} tokens`:c+=`${v}% reduction from reuse`,o.push(`${n.green}${c}${n.reset}`)}o.push("")}else{let c=[`load:${D}obs/${N}t`];T>0&&(c.push(`invested:${T}t`),s.showSavingsPercent&&c.push(`savings:${v}%`)),o.push(`<context-economics>${c.join("|")}</context-economics>`),o.push("")}let I=b[0]?.id,H=p.map((c,R)=>{let A=R===0?null:b[R+1];return{...c,displayEpoch:A?A.created_at_epoch:c.created_at_epoch,displayTime:A?A.created_at:c.created_at,shouldShowLink:c.id!==I}}),q=new Set(E.slice(0,s.fullObservationCount).map(c=>c.id)),K=[...X.map(c=>({type:"observation",data:c})),...H.map(c=>({type:"summary",data:c}))];K.sort((c,R)=>{let A=c.type==="observation"?c.data.created_at_epoch:c.data.displayEpoch,w=R.type==="observation"?R.data.created_at_epoch:R.data.displayEpoch;return A-w});let U=new Map;for(let c of K){let R=c.type==="observation"?c.data.created_at:c.data.displayTime,A=Ee(R);U.has(A)||U.set(A,[]),U.get(A).push(c)}let j=Array.from(U.entries()).sort((c,R)=>{let A=new Date(c[0]).getTime(),w=new Date(R[0]).getTime();return A-w});for(let[c,R]of j){e?(o.push(`${n.bright}${n.cyan}${c}${n.reset}`),o.push("")):o.push(`<observations date="${c}">`);let A=null,w="";for(let oe of R)if(oe.type==="summary"){let h=oe.data,B=h.request||"Session started",k=$e(h.displayTime);e?o.push(`\u{1F3AF} ${n.yellow}#S${h.id}${n.reset} ${B} (${k})`):o.push(`\u{1F3AF}S${h.id}|${k}|${B}`),A=null,w=""}else{let h=oe.data,B=xe(h.files_modified,t);e&&B!==A&&(o.push(`${n.dim}${B}${n.reset}`),A=B,w="");let k=Ue(h.created_at),J=h.title||"Untitled",Q=fe[h.type]||"\u2022",Xe=(h.title?.length||0)+(h.subtitle?.length||0)+(h.narrative?.length||0)+JSON.stringify(h.facts||[]).length,G=Math.ceil(Xe/Fe),P=h.discovery_tokens||0,z=Re[h.type]||"\u{1F50D}",ie=k!==w,he=ie?k:"";if(w=k,q.has(h.id)){let $=s.fullObservationField==="narrative"?h.narrative:h.facts?me(h.facts).join(`
`):null;if(e){let W=ie?`${n.dim}${k}${n.reset}`:" ".repeat(k.length),Z=s.showReadTokens&&G>0?`${n.dim}(~${G}t)${n.reset}`:"",Se=s.showWorkTokens&&P>0?`${n.dim}(${z} ${P.toLocaleString()}t)${n.reset}`:"";o.push(`  ${n.dim}#${h.id}${n.reset}  ${W}  ${Q}  ${n.bright}${J}${n.reset}`),$&&o.push(`    ${n.dim}${$}${n.reset}`),(Z||Se)&&o.push(`    ${Z} ${Se}`),o.push("")}else{let W=[];s.showReadTokens&&W.push(`r${G}`),s.showWorkTokens&&P>0&&W.push(`${z}${P}`),o.push(`#${h.id}|${he}|${Q}|${J}|${W.join("|")}`),$&&o.push($),A=null}}else if(e){let $=ie?`${n.dim}${k}${n.reset}`:" ".repeat(k.length),W=s.showReadTokens&&G>0?`${n.dim}(~${G}t)${n.reset}`:"",Z=s.showWorkTokens&&P>0?`${n.dim}(${z} ${P.toLocaleString()}t)${n.reset}`:"";o.push(`  ${n.dim}#${h.id}${n.reset}  ${$}  ${Q}  ${J} ${W} ${Z}`)}else{let $=[];s.showReadTokens&&$.push(`r${G}`),s.showWorkTokens&&P>0&&$.push(`${z}${P}`),o.push(`#${h.id}|${he}|${Q}|${J}|${$.join("|")}`)}}e||o.push("</observations>"),o.push("")}let m=b[0],ge=E[0];if(s.showLastSummary&&m&&(m.investigated||m.learned||m.completed||m.next_steps)&&(!ge||m.created_at_epoch>ge.created_at_epoch))if(e)o.push(...re("Investigated",m.investigated,n.blue,e)),o.push(...re("Learned",m.learned,n.yellow,e)),o.push(...re("Completed",m.completed,n.green,e)),o.push(...re("Next Steps",m.next_steps,n.magenta,e));else{let c=[];m.investigated&&c.push(`inv:${m.investigated}`),m.learned&&c.push(`learned:${m.learned}`),m.completed&&c.push(`done:${m.completed}`),m.next_steps&&c.push(`next:${m.next_steps}`),c.length>0&&(o.push("<last-session>"),c.forEach(R=>o.push(R)),o.push("</last-session>"))}if(S&&(e?(o.push(""),o.push("---"),o.push(""),o.push(`${n.bright}${n.magenta}\u{1F4CB} Previously${n.reset}`),o.push(""),o.push(`${n.dim}A: ${S}${n.reset}`),o.push("")):o.push(`<previously>${S}</previously>`)),e&&g&&T>0&&f>0){let c=Math.round(T/1e3);o.push(""),o.push(`${n.dim}\u{1F4B0} Access ${c}k tokens of past research & decisions for just ${N.toLocaleString()}t. Use the mem-search skill to access memories by ID instead of re-reading files.${n.reset}`)}e||o.push("</claude-mem-context>")}return i?.close(),o.join(`
`).trimEnd()}0&&(module.exports={generateContext});
