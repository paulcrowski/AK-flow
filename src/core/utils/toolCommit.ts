export type ToolCommitAction = 'CREATE' | 'APPEND' | 'REPLACE';

export type ToolCommitDetails = {
  action: ToolCommitAction;
  artifactId: string;
  artifactName: string;
  deltaChars: number;
  deltaLines?: number;
  preview: string;
};

const PREVIEW_MAX = 120;

const normalizePreviewText = (input: string) => String(input || '').replace(/\s+/g, ' ').trim();

const countLines = (input: string) => {
  const text = String(input || '');
  if (!text) return 0;
  return text.split(/\r?\n/).length;
};

const buildPreview = (input: string) => {
  const normalized = normalizePreviewText(input);
  if (!normalized) return '(empty)';
  if (normalized.length <= PREVIEW_MAX) return normalized;
  const trimmed = normalized.slice(0, PREVIEW_MAX - 3).trimEnd();
  return `${trimmed}...`;
};

const formatSigned = (value: number) => {
  if (value > 0) return `+${value}`;
  return String(value);
};

export function buildToolCommitDetails(params: {
  action: ToolCommitAction;
  artifactId: string;
  artifactName: string;
  beforeContent?: string;
  afterContent?: string;
  deltaText?: string;
}): ToolCommitDetails | null {
  const action = params.action;
  const artifactId = String(params.artifactId || '').trim();
  const artifactName = String(params.artifactName || '').trim();
  if (!artifactId || !artifactName) return null;

  const before = String(params.beforeContent ?? '');
  const after = String(params.afterContent ?? '');
  let deltaText = params.deltaText;

  if (action === 'APPEND' && deltaText === undefined) {
    if (after.startsWith(before)) {
      deltaText = after.slice(before.length);
    } else {
      deltaText = '';
    }
  }

  if (action === 'CREATE') {
    const base = String(deltaText ?? after);
    return {
      action,
      artifactId,
      artifactName,
      deltaChars: base.length,
      deltaLines: countLines(base),
      preview: buildPreview(base)
    };
  }

  if (action === 'APPEND') {
    const base = String(deltaText ?? '');
    return {
      action,
      artifactId,
      artifactName,
      deltaChars: base.length,
      deltaLines: countLines(base),
      preview: buildPreview(base)
    };
  }

  const deltaChars = after.length - before.length;
  const deltaLines = countLines(after) - countLines(before);
  const previewSource = String(deltaText ?? after);

  return {
    action,
    artifactId,
    artifactName,
    deltaChars,
    deltaLines,
    preview: buildPreview(previewSource)
  };
}

export function formatToolCommitMessage(details: ToolCommitDetails): string {
  const deltaChars = formatSigned(details.deltaChars);
  const deltaLines = typeof details.deltaLines === 'number' ? `, ${formatSigned(details.deltaLines)} lines` : '';
  return `Commit ${details.action} ${details.artifactName} (${details.artifactId}) ${deltaChars} chars${deltaLines}. Preview: ${details.preview}`;
}
