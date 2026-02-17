# Design Document: COA Improvement & Dark Mode Support

**Date:** 2026-02-17
**Status:** Approved
**Topic:** Chart of Accounts (COA) Visual & Functional Overhaul

## 1. Overview
The current Chart of Accounts (COA) interface is cluttered, difficult to navigate for non-accountants, and has significant Dark Mode issues (inconsistent colors, unreadable text). This design aims to simplify the structure using a **Tabbed Focus** approach and implement a robust **Semantic Dark Mode**.

## 2. Visual Design (UI)

### 2.1 Tabbed Navigation
Instead of a single long list, the COA will be divided into 5 high-level tabs:
1.  **Aset** (Assets) - Blue Theme
2.  **Kewajiban** (Liabilities) - Red Theme
3.  **Modal** (Equity) - Purple Theme
4.  **Pendapatan** (Revenue) - Green Theme
5.  **Beban** (Expenses) - Orange Theme

**Why:** Reduces cognitive load by showing only ~20% of accounts at a time.

### 2.2 List Structure & Hierarchy
*   **Header Accounts (Groups):**
    *   **Visual:** Bold text, Folder icon (📂).
    *   **Background:** Light gray (`bg-gray-50 dark:bg-gray-800`).
    *   **Action:** Expand/Collapse only. No transactions allowed.
*   **Transaction Accounts (Children):**
    *   **Visual:** Normal text, File icon (📄).
    *   **Background:** White (`bg-white dark:bg-gray-900`).
    *   **Code:** De-emphasized (small, gray) to focus on the Account Name.
    *   **Action:** Edit, Delete (if unused), View Ledger.

### 2.3 Dark Mode Implementation
We will use Tailwind's `dark:` modifier with semantic color mapping.

| Component | Light Mode | Dark Mode | Note |
| :--- | :--- | :--- | :--- |
| **Main Background** | `bg-white` | `bg-gray-900` | High contrast base |
| **Card/Panel** | `bg-white` border-gray-200 | `bg-gray-800` border-gray-700 | Surface separation |
| **Primary Text** | `text-gray-900` | `text-gray-100` | Readable main text |
| **Secondary Text** | `text-gray-500` | `text-gray-400` | Descriptions/Codes |
| **Row Hover** | `hover:bg-gray-50` | `hover:bg-gray-700/50` | Interactive feedback |
| **Asset Badge** | `bg-blue-100 text-blue-800` | `bg-blue-900/30 text-blue-200` | Transparent for better contrast |
| **Liability Badge** | `bg-red-100 text-red-800` | `bg-red-900/30 text-red-200` | Transparent for better contrast |

## 3. Data Structure & Logic

### 3.1 Schema Utilization
We will leverage existing fields in `prisma/schema.prisma`:
*   `isHeader` (Boolean): Determines if an account is a group (folder) or transaction account (file).
*   `allowPosting` (Boolean):
    *   `true` for Transaction Accounts.
    *   `false` for Header Accounts.

### 3.2 Constraints & Validation
1.  **Hierarchy Depth:** Maximum 4 levels (Category -> Header -> Sub-Header -> Transaction).
2.  **Transaction Rules:**
    *   Transactions can ONLY be posted to accounts where `allowPosting: true`.
    *   Header accounts cannot have transactions.
3.  **Deletion Rules:**
    *   Cannot delete an account that has existing transactions (foreign key check).
    *   Cannot delete a Header account that still has children (must delete children first).

### 3.3 Account Creation Workflow
*   **Contextual Add:** Clicking "Add" next to a Header Account (e.g., "1100 - Current Assets") automatically:
    *   Sets `parentId` to that account.
    *   Sets `type` to match the parent.
    *   **Auto-Suggests Number:** Finds the last child (e.g., 1104) and suggests 1105.

## 4. Implementation Strategy

### Phase 1: Data Migration & Cleanup
*   Script to update `isHeader` and `allowPosting` based on current children existence.
*   Ensure all existing transaction data points to valid `allowPosting: true` accounts.

### Phase 2: UI Overhaul
*   Refactor `COAManager.tsx` to support Tabs.
*   Implement the recursive tree rendering with the new design (Folder/File icons).
*   Apply Dark Mode classes throughout.

### Phase 3: Logic Enforcement
*   Update `createCoaSchema` in Zod to validate hierarchy rules.
*   Update API endpoints to enforce `allowPosting` checks.
