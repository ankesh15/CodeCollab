import { Request, Response, NextFunction } from 'express';
import { ApiResponse, CodeDocumentSummary } from '@codecollab/shared';
import { ensureDocument, updateDocumentLanguage } from '../services/document.service';

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
    const { language } = req.body;

    if (!roomId || !language || typeof language !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Room ID and valid language string are required.',
        error: 'BAD_REQUEST',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const doc = await updateDocumentLanguage(roomId, language);

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
