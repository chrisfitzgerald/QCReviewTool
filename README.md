# Reviewer Assigner

A simple, modern web app to randomly assign a smaller group of reviewers to a larger group of reviewees.

## Features
- Enter reviewers and reviewees (comma or newline separated)
- Randomly assigns all reviewees to reviewers
- Modern, responsive design, neat...

## How to Use

1. **Select a Team Vertical:**
   - Click a tab at the top to choose the relevant team or project area.
2. **Enter or Edit Reviewers and Reviewees:**
   - Reviewers (QCers) are those who will review; Reviewees (QC Targets) are those being reviewed.
   - Click **Edit** to modify either list, then **Save**.
   - Names can be entered comma- or newline-separated.
3. **Assign Reviewers:**
   - Click **Assign QCers** to randomly assign reviewers, ensuring no one reviews themselves.
4. **Review Assignments:**
   - See the assignments and last assigned time on the right.

### Tips & Notes
- **No Self-Review:** The tool never assigns someone to review themselves. This check is based on exact text matches between the QCers and QC Targets lists. If there is any difference in spelling, extra spaces, or formatting, the check will not work as expected. Please ensure names are entered consistently in both lists.
- **Unassigned Targets:** If a QC Target can't be assigned (e.g., if they are also a QCer and no other QCer is available), a warning will appear.
- **Saving Lists:** You can save your lists without assigning by clicking **Save** after editing.

---
MIT License 