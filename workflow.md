# Smart Attendance System - Navigation & Workflow

## Overview
This document outlines the user flow and navigation for the Smart Attendance System web application.

## Navigation Flow

### 1. Dashboard (Home)
- **Entry Point**: This is the landing page after login (simulated as default page).
- **Key Elements**:
    - **Header**: Logo (Veloces Campus), User Profile, Navigation Menu.
    - **Quick Actions**: "Mark Attendance", "View History", "Generate Reports".
    - **Stats Overview**: Today's Status, Monthly Attendance %, Pending Actions.
- **Navigation Options**:
    - Click "Mark Attendance" -> Navigates to **Mark Attendance Page**.
    - Click "Attendance History" card -> Navigates to **History Page**.
    - Click "Reports" -> Navigates to **Reports Page**.

### 2. Mark Attendance Page
- **Purpose**: Verify identity and location to mark presence.
- **Workflow**:
    1.  **System Check**: Page loads camera feed (Face Verification) and map (Geo-Fencing).
    2.  **User Action**: User aligns face in frame.
    3.  **Process**: System verifies Face + Location automatically or via "Verify Now" button.
    4.  **Success**: Green success checkmark appears.
    5.  **Completion**: Redirects back to Dashboard or shows "Attendance Marked" confirmation.
- **Navigation**:
    - Back button -> Returns to **Dashboard**.

### 3. Attendance History Page
- **Purpose**: View past attendance records.
- **Workflow**:
    1.  **View**: List of records (Date, Time, Status, Verified By).
    2.  **Filter**: User filters by Status (Present/Absent) or Date Range.
    3.  **Details**: Clicking a row could expand details (optional).
- **Navigation**:
    - Sidebar/Header links -> Navigate to other modules.

### 4. Reports Page
- **Purpose**: Analytics and compliance reporting.
- **Workflow**:
    1.  **Visuals**: View bar charts/pie charts of attendance trends.
    2.  **Export**: "Download PDF/CSV" button.
- **Navigation**:
    - Main Menu -> Return to **Dashboard**.

## Visual Theme
- **Primary Color**: #F05123 (Orange)
- **Style**: Glassmorphism, Clean, Modern, Round Corners.
