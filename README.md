# Caliber Beta

A role calibration tool that analyzes alignment between professional background and job opportunities.

## Overview

Caliber Beta v1 uses AI-powered extraction combined with deterministic scoring to provide insights on role alignment. The system extracts structural patterns from resumes and job descriptions, then applies locked formulas to compute alignment scores and skill match metrics.

## Features

- **Person Vector Extraction**: Analyzes resume and prompt answers to extract 6-dimensional structural pattern
- **Role Vector Extraction**: Analyzes job descriptions to extract role requirements and structural pattern
- **Alignment Scoring**: Deterministic computation of role-person alignment (0-10 scale)
- **Skill Match Analysis**: Classification of requirements as grounded/adjacent/new
- **Pattern Synthesis**: Generates insights about operating patterns and structural tensions

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file with your OpenAI API key:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to use the application.

### Building for Production

```bash
npm run build
npm start
```

## Architecture

### Core Separation Boundary
- **LLM Layer** (`lib/openai/`): Extracts structured data ONLY (never computes scores)
- **Deterministic Engine** (`lib/`): Computes all scores using locked formulas

### Six Locked Dimensions

1. structural_maturity
2. authority_scope
3. revenue_orientation
4. role_ambiguity
5. breadth_vs_depth
6. stakeholder_density

Each dimension is scored 0, 1, or 2 by the LLM extraction layer.

## Project Structure

```
├── app/
│   ├── page.tsx                    # Intake form
│   ├── results/page.tsx           # Results display
│   └── api/calibrate/route.ts     # API endpoint
├── lib/
│   ├── types.ts                    # TypeScript interfaces
│   ├── alignment.ts                # Alignment score computation
│   ├── skillMatch.ts              # Skill match computation
│   ├── stretch.ts                 # Stretch load computation
│   ├── patternSynthesis.ts        # Pattern synthesis formatting
│   └── openai/
│       ├── client.ts              # OpenAI client configuration
│       ├── personExtract.ts       # Person vector extraction
│       ├── roleExtract.ts         # Role vector extraction
│       └── requirementsClassify.ts # Requirement classification
```

## Deployment

The application is configured for deployment on Vercel. Make sure to set the `OPENAI_API_KEY` environment variable in your Vercel project settings.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)

