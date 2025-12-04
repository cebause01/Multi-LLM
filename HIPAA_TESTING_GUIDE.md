# HIPAA Function Testing Guide

## How to Test HIPAA Compliance Feature

### Step 1: Enable HIPAA Toggle
1. Open the application at `http://localhost:3000`
2. In the sidebar, scroll to the "Judge Model" section
3. You'll see a toggle switch labeled "HIPAA" below the judge model dropdown
4. Click the toggle to turn it ON (it will show "PHI/PII filtering enabled")

### Step 2: Test Cases

#### Test Case 1: Phone Numbers
**Input:**
```
My patient's phone number is 555-123-4567. Please call them.
```

**Expected Result:**
- Response should show `[REDACTED]` instead of the phone number
- Or the model should avoid including the phone number entirely

#### Test Case 2: Email Addresses
**Input:**
```
Contact the patient at john.doe@example.com for follow-up.
```

**Expected Result:**
- Email address should be redacted as `[REDACTED]`

#### Test Case 3: Social Security Numbers
**Input:**
```
The patient's SSN is 123-45-6789.
```

**Expected Result:**
- SSN should be redacted as `[REDACTED]`

#### Test Case 4: Dates of Birth
**Input:**
```
Patient was born on 01/15/1985 and needs follow-up care.
```

**Expected Result:**
- Date of birth should be redacted

#### Test Case 5: Medical Record Numbers
**Input:**
```
Patient MRN: 12345678 requires immediate attention.
```

**Expected Result:**
- MRN should be redacted

#### Test Case 6: Combined PHI/PII
**Input:**
```
Patient John Doe (DOB: 03/22/1975, SSN: 456-78-9012, Phone: 555-987-6543, Email: jdoe@hospital.com, MRN: 98765) needs urgent care.
```

**Expected Result:**
- All identifying information should be redacted or avoided
- Response should use generic terms like "the patient" instead of names

### Step 3: What to Verify

1. **Prompt Instructions**: Check browser console (F12) - you should see HIPAA instructions being added to prompts
2. **Response Filtering**: Look for `[REDACTED]` in responses where PHI/PII was detected
3. **Model Behavior**: Models should avoid repeating PHI/PII from your input
4. **Judge Model**: The judge should prioritize responses without identifying information

### Step 4: Compare ON vs OFF

1. **Test with HIPAA OFF:**
   - Send a message with PHI/PII
   - Note that responses may include the sensitive information

2. **Test with HIPAA ON:**
   - Send the same message
   - Verify that responses are filtered and PHI/PII is redacted

### Step 5: Check All Responses

1. After sending a message, click the expand button (▶) to see all model responses
2. Verify that all responses have been filtered
3. Check that the judge's reasoning also doesn't contain PHI/PII

## Quick Test Prompt

Copy and paste this into the chat with HIPAA enabled:

```
"Please help me with a patient case. The patient's name is Sarah Johnson, born on 05/10/1980. Her phone number is 555-234-5678, email is sarah.j@email.com, and her SSN is 789-12-3456. Her medical record number is MRN-456789. She lives at 123 Main Street, Anytown, ST 12345. Please provide recommendations."
```

**Expected Result:**
- All names, dates, phone numbers, emails, SSN, addresses, and MRN should be redacted or avoided
- Response should use generic terms like "the patient" or "the individual"

## Troubleshooting

If HIPAA filtering isn't working:
1. Make sure the toggle is ON (shows "PHI/PII filtering enabled")
2. Check browser console for any errors
3. Verify the server is running and receiving the `hipaaEnabled` parameter
4. Try refreshing the page and testing again

