import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiResponse, CodeDocumentSummary } from '@codecollab/shared';
import { ensureDocument, updateDocumentLanguage } from '../services/document.service';
import { SUPPORTED_LANGUAGE_IDS } from '../config/languages';

const updateLanguageSchema = z
  .object({
    language: z.string().refine((lang) => SUPPORTED_LANGUAGE_IDS.includes(lang.toLowerCase().trim()), {
      message: `Invalid language. Supported languages: ${SUPPORTED_LANGUAGE_IDS.join(', ')}`,
    }),
  })
  .strict();

export async function getDocumentController(
  req: Request,
  res: Response<ApiResponse<{ document: CodeDocumentSummary }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      res.status(400).json({
        success: false,
        message: 'Room ID is required.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const doc = await ensureDocument(roomId);

    res.status(200).json({
      success: true,
      message: 'Code document retrieved successfully.',
      data: {
        document: {
          id: doc.id,
          roomId: doc.roomId,
          content: doc.content,
          language: doc.language,
          version: doc.version,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateLanguageController(
  req: Request,
  res: Response<ApiResponse<{ document: CodeDocumentSummary }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      res.status(400).json({
        success: false,
        message: 'Room ID is required.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const parseResult = updateLanguageSchema.safeParse(req.body);
    if (!parseResult.success) {
      const formattedErrors = parseResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({
        success: false,
        message: 'Validation failed for document language update.',
        error: 'VALIDATION_FAILED',
        errors: formattedErrors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const doc = await updateDocumentLanguage(roomId, parseResult.data.language.toLowerCase().trim());

    res.status(200).json({
      success: true,
      message: 'Document language updated successfully.',
      data: {
        document: {
          id: doc.id,
          roomId: doc.roomId,
          content: doc.content,
          language: doc.language,
          version: doc.version,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
