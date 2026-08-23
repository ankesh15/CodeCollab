import { Request, Response, NextFunction } from 'express';
import { ApiResponse, AuthResponseData, SafeUser } from '@codecollab/shared';
import { registerSchema, loginSchema } from '../schemas/auth.schema';
import { registerUser, loginUser, getUserProfile, updateUserProfile, AppError } from '../services/auth.service';

export async function registerController(
  req: Request,
  res: Response<ApiResponse<AuthResponseData>>,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = registerSchema.safeParse(req.body);

    if (!parseResult.success) {
      const formattedErrors = parseResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({
        success: false,
        message: 'Validation failed for registration input.',
        error: 'VALIDATION_FAILED',
        errors: formattedErrors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const authData = await registerUser(parseResult.data);

    res.status(201).json({
      success: true,
      message: 'User account registered successfully.',
      data: authData,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        error: err.errorCode,
        errors: err.errors,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(err);
  }
}

export async function loginController(
  req: Request,
  res: Response<ApiResponse<AuthResponseData>>,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = loginSchema.safeParse(req.body);

    if (!parseResult.success) {
      const formattedErrors = parseResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({
        success: false,
        message: 'Validation failed for login credentials.',
        error: 'VALIDATION_FAILED',
        errors: formattedErrors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const authData = await loginUser(parseResult.data);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: authData,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        error: err.errorCode,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(err);
  }
}

export async function getMeController(
  req: Request,
  res: Response<ApiResponse<{ user: SafeUser }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const safeUser = await getUserProfile(req.user.userId);

    res.status(200).json({
      success: true,
      message: 'Authenticated user profile retrieved successfully.',
      data: { user: safeUser },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        error: err.errorCode,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(err);
  }
}

export async function updateMeController(
  req: Request,
  res: Response<ApiResponse<{ user: SafeUser }>>,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        error: 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { bio, avatar } = req.body;
    const safeUser = await updateUserProfile(req.user.userId, { bio, avatar });

    res.status(200).json({
      success: true,
      message: 'User profile updated successfully.',
      data: { user: safeUser },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        error: err.errorCode,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(err);
  }
}

