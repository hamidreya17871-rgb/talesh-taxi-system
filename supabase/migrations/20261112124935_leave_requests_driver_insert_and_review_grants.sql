/*
# Allow leave requests to be saved and reviewed

1. Problem
- Drivers could not save any leave request, including short leave that should be approved automatically, because the table had no insert permission for signed-in users.
- Managers and experts could not approve or reject requests for the same reason.

2. Changes
- Signed-in users may insert leave requests, but only into the columns the leave form fills in. Status, approver and request owner are still set by the server (trigger and row rules).
- Signed-in users may update only the status and review columns. The existing row rules still limit this to managers and experts reviewing pending requests.

3. Security
- No existing row rules are changed. The insert rule still forces the driver's own record, the request owner, and an allowed status. The review rule still requires a pending request and the reviewer's own identity.
*/

GRANT INSERT (driver_id, leave_type, start_date, end_date, reason, destination_province, destination_city)
  ON public.leave_requests TO authenticated;

GRANT UPDATE (status, reviewed_by, reviewed_at)
  ON public.leave_requests TO authenticated;
