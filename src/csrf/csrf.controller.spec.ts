import { BadRequestException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import type { Request, Response } from 'express';

import { CsrfController } from './csrf.controller.js';

describe('CsrfController', () => {
  let controller: CsrfController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CsrfController],
    }).compile();

    controller = module.get<CsrfController>(CsrfController);
  });

  it('should return a CSRF token and set cookie', () => {
    const mockRequest = {
      csrfToken: jest.fn().mockReturnValue('mock-csrf-token'),
    } as unknown as Request;
    const mockResponse = {
      cookie: jest.fn(),
    } as unknown as Response;

    const result = controller.getCsrfToken(mockRequest, mockResponse);

    expect(mockRequest.csrfToken).toHaveBeenCalled();
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      '_csrf',
      'mock-csrf-token',
      {
        httpOnly: true,
        secure: expect.any(Boolean),
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
      }
    );
    expect(result).toEqual({ csrfToken: 'mock-csrf-token' });
  });

  it('should throw BadRequestException if csrfToken is undefined', () => {
    const mockRequest = {} as Request;
    const mockResponse = {
      cookie: jest.fn(),
    } as unknown as Response;

    expect(() => controller.getCsrfToken(mockRequest, mockResponse)).toThrow(
      BadRequestException
    );
    expect(() => controller.getCsrfToken(mockRequest, mockResponse)).toThrow(
      'CSRF token generator is not available'
    );
  });
});
