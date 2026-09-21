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
  // Check if room exists before upserting document
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, language: true },
  });

  if (!room) {
    const error = new Error(`Cannot ensure document: Room ${roomId} does not exist.`) as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  const defaultContent =
    room.language === 'cpp'
      ? `// C++ Workspace\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello CodeCollab!" << endl;\n    return 0;\n}`
      : room.language === 'python'
      ? `# Python Workspace\nprint("Hello CodeCollab!")`
      : `// JavaScript Workspace\nconsole.log("Hello CodeCollab!");`;

  return prisma.codeDocument.upsert({
    where: { roomId },
    update: {},
    create: {
      roomId,
      language: room.language || 'javascript',
      content: defaultContent,
      version: 1,
    },
  });
}

export async function updateDocument(
  roomId: string,
  content: string,
  version: number,
  language?: string
): Promise<CodeDocument | null> {
  try {
    const doc = await ensureDocument(roomId);

    return await prisma.codeDocument.update({
      where: { id: doc.id },
      data: {
        content,
        version,
        ...(language ? { language } : {}),
      },
    });
  } catch (err: unknown) {
    // If room was deleted while debounce timer was pending, exit cleanly
    const error = err as { statusCode?: number; code?: string };
    if (error?.statusCode === 404 || error?.code === 'P2003' || error?.code === 'P2025') {
      return null;
    }
    throw err;
  }
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
