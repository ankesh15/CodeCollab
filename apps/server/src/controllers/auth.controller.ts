import { Request, Response, NextFunction } from 'express';
import { ApiResponse, AuthResponseData, RefreshTokenResponseData, SafeUser } from '@codecollab/shared';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '../schemas/auth.schema';
import {
  registerUser,
  loginUser,
  refreshAccessTokenService,
  logoutService,
  changePasswordService,
  deactivateAccountService,
  getUserProfile,
  updateUserProfile,
  AppError,
} from '../services/auth.service';

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

export async function refreshController(
  req: Request,
  res: Response<ApiResponse<RefreshTokenResponseData>>,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = refreshTokenSchema.safeParse(req.body);

    if (!parseResult.success) {
      const formattedErrors = parseResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({
        success: false,
        message: 'Validation failed for refresh token.',
        error: 'VALIDATION_FAILED',
        errors: formattedErrors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const tokenData = await refreshAccessTokenService(parseResult.data.refreshToken);

    res.status(200).json({
      success: true,
      message: 'Access token refreshed successfully.',
      data: tokenData,
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

export async function logoutController(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const refreshToken = req.body?.refreshToken;
    const userId = req.user?.userId;

    const result = await logoutService(refreshToken, userId);

    res.status(200).json({
      success: true,
      message: result.message,
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

export async function changePasswordController(
  req: Request,
  res: Response<ApiResponse>,
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

    const parseResult = changePasswordSchema.safeParse(req.body);

    if (!parseResult.success) {
      const formattedErrors = parseResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({
        success: false,
        message: 'Validation failed for password change.',
        error: 'VALIDATION_FAILED',
        errors: formattedErrors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await changePasswordService(
      req.user.userId,
      parseResult.data.currentPassword,
      parseResult.data.newPassword
    );

    res.status(200).json({
      success: true,
      message: result.message,
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

export async function deactivateController(
  req: Request,
  res: Response<ApiResponse>,
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

    const result = await deactivateAccountService(req.user.userId);

    res.status(200).json({
      success: true,
      message: result.message,
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

    const parseResult = updateProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      const formattedErrors = parseResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({
        success: false,
        message: 'Validation failed for profile update.',
        error: 'VALIDATION_FAILED',
        errors: formattedErrors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { bio, avatar } = parseResult.data;
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
