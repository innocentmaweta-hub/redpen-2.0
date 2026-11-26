# RedPen 2.0

A clean React + TypeScript application for organising examination marking and student assessment.

## Current foundation
- Workbooks and courses
- Student and assessment setup
- Marking-scheme and answer-paper uploads with preview
- Manual question-level scoring with validation and automatic totals/grades
- Saved results and grading history
- Batch paper queue preparation
- Browser-local persistence and JSON backup export
- Responsive workspace navigation and Yaza workflow guidance

## Integrations
The clean rebuild deliberately does not inherit the previous application's authentication, payment, API, cloud-storage or AI grading implementation. AI grading is explicitly marked as not connected; no automated marks are fabricated. These services should be integrated through separately designed, typed service boundaries.

## Development
`npm install`
`npm run dev`

## Build
`npm run build`

Workspace records are currently stored in this browser's local storage. Export a JSON backup from Settings before clearing browser data.
