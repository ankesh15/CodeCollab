import { CodeDocument } from '@prisma/client';
import { prisma } from '../config/db';

export async function getDocument(roomId: string): Promise<CodeDocument | null> {
  return prisma.codeDocument.findUnique({
    where: { roomId },
  });
}

export async function createDocument(
  roomId: string,
  language: string = 'cpp',
  content: string = ''
): Promise<CodeDocument> {
  const defaultContent =
    content ||
    (language === 'cpp'
      ? `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write C++ code here\n    cout << "Hello CodeCollab!" << endl;\n    return 0;\n}`
      : language === 'python'
      ? `# Python Workspace\nprint("Hello CodeCollab!")`
      : `// JavaScript Workspace\nconsole.log("Hello CodeCollab!");`);

  return prisma.codeDocument.create({
    data: {
      roomId,
      language,
      content: defaultContent,
      version: 1,
    },
  });
}

export async function ensureDocument(roomId: string): Promise<CodeDocument> {
  const existing = await getDocument(roomId);
  if (existing) {
    return existing;
  }
  return createDocument(roomId);
}

export async function updateDocument(
  roomId: string,
  content: string,
  version: number,
  language?: string
): Promise<CodeDocument> {
  const doc = await ensureDocument(roomId);

  return prisma.codeDocument.update({
    where: { id: doc.id },
    data: {
      content,
      version,
      ...(language ? { language } : {}),
    },
  });
}

export async function updateDocumentLanguage(roomId: string, language: string): Promise<CodeDocument> {
  const doc = await ensureDocument(roomId);

  // Also update Room's language field for synchronization
  await prisma.room.update({
    where: { id: roomId },
    data: { language },
  });

  return prisma.codeDocument.update({
    where: { id: doc.id },
    data: { language },
  });
}
