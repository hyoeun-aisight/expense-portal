# Expense Portal V1

Static GitHub Pages starter for reimbursement and purchase request workflows.

## What works now
- Dashboard
- Reimbursement submission
- Purchase request submission
- Automatic approval route by amount
  - <= 500,000 KRW: Office Admin
  - 500,001 - 2,000,000 KRW: Office Admin -> Finance Manager
  - >= 2,000,001 KRW: Office Admin -> Finance Manager -> Director
- Reimbursement route: Office Admin -> Accountant
- Approval / rejection demo
- Request list and status tracking
- CSV export
- Responsive layout

## Important limitation
This V1 stores data in the browser using `localStorage`. It is only for UI/workflow testing. Data is not shared between users or devices and should not be used for real company expense data yet.

## GitHub Pages upload
1. Create a new GitHub repository.
2. Extract this ZIP.
3. Open the extracted `expense-portal` folder.
4. In GitHub: Add file -> Upload files.
5. Drag all files and folders into GitHub and commit.
6. Go to Settings -> Pages.
7. Select Deploy from a branch -> `main` -> `/ (root)`.

## Next step: Supabase
Connect Supabase for:
- Google login
- real shared database
- roles and permissions
- receipt / quotation uploads
- approval history
- accountant access
- Row Level Security (RLS)

`js/supabase-config.example.js` is included as a placeholder for the next phase.
