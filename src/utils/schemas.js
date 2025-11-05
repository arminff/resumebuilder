import { z } from 'zod';

export const generateSchema = z.object({
  jobDescription: z.string().min(30).optional(),
  jobUrl: z.string().url().optional(),
  userProfile: z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    location: z.string().optional(),
    summary: z.string().optional(),
    experiences: z.array(z.object({
      title: z.string(),
      company: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      bullets: z.array(z.string()).optional()
    })).default([]),
    skills: z.array(z.string()).default([]),
    education: z.array(z.object({
      school: z.string(),
      degree: z.string().optional(),
      year: z.string().optional()
    })).default([])
  }),
  model: z.string().optional(),
  template: z.enum(['modern', 'classic', 'minimal']).optional().default('modern')
}).refine((data) => data.jobDescription || data.jobUrl, {
  message: "Either jobDescription or jobUrl must be provided"
});

export const pdfSchema = z.object({
  html: z.string().min(10)
});

export const scrapeSchema = z.object({ url: z.string().url() });


