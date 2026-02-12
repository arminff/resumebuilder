import { z } from 'zod';

export const generateSchema = z
  .object({
    jobDescription: z.string().min(30).optional(),
    jobUrl: z.string().url().optional(),
    userProfile: z.object({
      fullName: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional(),
      location: z.string().optional(),
      website: z.string().optional(),
      linkedin: z.string().optional(),
      summary: z.string().optional(),
      objective: z.string().optional(),
      experiences: z
        .array(
          z.object({
            title: z.string(),
            company: z.string().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            website: z.string().optional(),
            bullets: z.array(z.string()).optional(),
          }),
        )
        .default([]),
      skills: z.array(z.string()).default([]),
      education: z
        .array(
          z.object({
            school: z.string(),
            degree: z.string().optional(),
            year: z.string().optional(),
            relevantCoursework: z.string().optional(),
          }),
        )
        .default([]),
      projects: z
        .array(
          z.object({
            name: z.string(),
            skills: z.array(z.string()).optional().default([]),
            date: z.string().optional(),
            description: z.array(z.string()).optional().default([]),
          }),
        )
        .optional()
        .default([]),
    }),
    model: z.string().optional(),
    template: z.enum(['modern', 'classic', 'minimal']).optional().default('modern'),
    pages: z.enum(['1', '2', '3']).optional().default('1'),
  })
  .refine((data) => data.jobDescription || data.jobUrl, {
    message: 'Either jobDescription or jobUrl must be provided',
  });

export const scrapeSchema = z.object({ url: z.string().url() });

// Subscription schemas
export const createCheckoutSchema = z.object({
  planId: z.enum(['basic', 'pro']),
});

export const portalSessionSchema = z.object({
  returnUrl: z.string().url().optional(),
});
