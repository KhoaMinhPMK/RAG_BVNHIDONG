#!/usr/bin/env node
/**
 * beforeMCPExecution — Gate các Supabase MCP tool có thể gây hậu quả không hoàn tác:
 *
 *   apply_migration   → luôn hỏi (xem migration name + đầu SQL)
 *   execute_sql       → hỏi nếu SQL có DROP / DELETE / TRUNCATE / ALTER DROP
 *   delete_branch     → luôn hỏi
 *   reset_branch      → luôn hỏi
 *   pause_project     → luôn hỏi
 *   restore_project   → luôn hỏi
 *
 * Input JSON (stdin):
 *   { tool_name: "apply_migration", server_name: "...", params: { ... } }
 *
 * Output JSON (stdout):
 *   { permission: "allow" | "ask", user_message?: "...", agent_message?: "..." }
 */
import { readFileSync } from 'node:fs';

function allow() {
  process.stdout.write(JSON.stringify({ permission: 'allow' }));
}

function ask(userMsg, agentMsg) {
  process.stdout.write(
    JSON.stringify({
      permission: 'ask',
      user_message: userMsg,
      agent_message: agentMsg ?? 'supabase-mcp-gate: yêu cầu xác nhận trước khi thực thi.',
    })
  );
}

/** Cắt bớt text dài để hiển thị preview */
function preview(str, maxLen = 300) {
  if (!str) return '(trống)';
  const s = String(str).trim();
  return s.length <= maxLen ? s : s.slice(0, maxLen) + '\n… (còn tiếp)';
}

/** Kiểm tra SQL có câu lệnh nguy hiểm không */
function isDangerousSQL(sql) {
  const normalized = String(sql ?? '')
    .replace(/--[^\n]*/g, '')    // bỏ single-line comment
    .replace(/\/\*[\s\S]*?\*\//g, '') // bỏ multi-line comment
    .toUpperCase();

  return (
    /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX|SEQUENCE|VIEW|FUNCTION|TRIGGER|EXTENSION)\b/.test(normalized) ||
    /\bTRUNCATE\b/.test(normalized) ||
    /\bDELETE\s+FROM\b/.test(normalized) ||
    /\bALTER\s+TABLE\b.*\bDROP\b/.test(normalized) ||
    /\bALTER\s+TABLE\b.*\bDROP\s+COLUMN\b/.test(normalized)
  );
}

let raw = '';
try {
  raw = readFileSync(0, 'utf8');
} catch {
  allow();
  process.exit(0);
}

let input = {};
try {
  input = raw ? JSON.parse(raw) : {};
} catch {
  allow();
  process.exit(0);
}

const toolName = String(input.tool_name ?? input.tool ?? '').trim().toLowerCase();
const params   = input.params ?? input.arguments ?? {};
const projectId = params.project_id ?? params.projectId ?? '(unknown)';

switch (toolName) {
  case 'apply_migration': {
    const migrationName = params.name ?? params.migration_name ?? '(không có tên)';
    const sqlPreview    = preview(params.query ?? params.sql ?? params.migration_sql, 400);

    ask(
      `Supabase MCP: **apply_migration** sắp chạy trên project \`${projectId}\`\n\n` +
      `**Tên migration:** \`${migrationName}\`\n\n` +
      `**SQL preview:**\n\`\`\`sql\n${sqlPreview}\n\`\`\`\n\n` +
      'Migration không thể hoàn tác dễ dàng. Xác nhận chạy không?',
      `supabase-mcp-gate: apply_migration "${migrationName}" trên project ${projectId} cần xác nhận.`,
    );
    break;
  }

  case 'execute_sql': {
    const sql = params.query ?? params.sql ?? '';
    if (isDangerousSQL(sql)) {
      ask(
        `Supabase MCP: **execute_sql** trên project \`${projectId}\` chứa lệnh nguy hiểm:\n\n` +
        `\`\`\`sql\n${preview(sql, 500)}\n\`\`\`\n\n` +
        'Lệnh DROP / DELETE / TRUNCATE / ALTER DROP không thể hoàn tác. Xác nhận chạy không?',
        `supabase-mcp-gate: execute_sql trên ${projectId} có câu lệnh phá huỷ dữ liệu.`,
      );
    } else {
      allow();
    }
    break;
  }

  case 'delete_branch': {
    const branch = params.branch_id ?? params.branch ?? '(unknown)';
    ask(
      `Supabase MCP: **delete_branch** \`${branch}\` trên project \`${projectId}\`\n\n` +
      'Nhánh DB bị xóa không thể khôi phục. Xác nhận không?',
      `supabase-mcp-gate: delete_branch "${branch}" cần xác nhận.`,
    );
    break;
  }

  case 'reset_branch': {
    const branch = params.branch_id ?? params.branch ?? '(unknown)';
    ask(
      `Supabase MCP: **reset_branch** \`${branch}\` trên project \`${projectId}\`\n\n` +
      'Reset branch sẽ xóa toàn bộ dữ liệu trong branch đó. Xác nhận không?',
      `supabase-mcp-gate: reset_branch "${branch}" cần xác nhận.`,
    );
    break;
  }

  case 'pause_project': {
    ask(
      `Supabase MCP: **pause_project** \`${projectId}\`\n\n` +
      'Project bị pause sẽ tạm ngừng toàn bộ dịch vụ (DB, Auth, Storage, Edge Functions). Xác nhận không?',
      `supabase-mcp-gate: pause_project "${projectId}" cần xác nhận.`,
    );
    break;
  }

  case 'restore_project': {
    ask(
      `Supabase MCP: **restore_project** \`${projectId}\`\n\n` +
      'Restore project từ backup sẽ ghi đè dữ liệu hiện tại. Xác nhận không?',
      `supabase-mcp-gate: restore_project "${projectId}" cần xác nhận.`,
    );
    break;
  }

  default:
    allow();
}

process.exit(0);
