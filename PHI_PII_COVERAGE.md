# PHI/PII Filtering Coverage

## Currently Filtered PHI/PII Types

### ✅ Names
- Full names (First Last)
- Individual name parts
- Replaced with: "the patient" (medical) or "the individual" (non-medical)

### ✅ Phone Numbers
- Formats: (XXX) XXX-XXXX, XXX-XXX-XXXX, XXX.XXX.XXXX
- Replaced with: `[PHONE]`

### ✅ Email Addresses
- Standard email format: user@domain.com
- Replaced with: `[EMAIL]`

### ✅ Social Security Numbers (SSN)
- Formats: XXX-XX-XXXX or XXXXXXXXX
- Replaced with: `[SSN]`

### ✅ Medical Record Numbers (MRN)
- Formats: MRN-123, MRN: 123, MRN #123
- Replaced with: `[MRN]`

### ✅ Dates
- Formats: MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY
- Includes: Birth dates, admission dates, discharge dates
- Replaced with: `[DATE]`

### ✅ Addresses
- Street addresses (e.g., "123 Main Street")
- Zip codes (5 digits or 5+4 format)
- Replaced with: `[ADDRESS]`

### ✅ Account Numbers
- Health plan beneficiary numbers
- Bank account numbers
- Account # patterns
- Replaced with: `[ACCOUNT]`

### ✅ License Numbers
- Driver's license numbers
- Passport numbers
- License # patterns
- Replaced with: `[LICENSE]`

### ✅ Fax Numbers
- Fax: (XXX) XXX-XXXX
- Replaced with: `[FAX]`

### ✅ URLs
- HTTP/HTTPS URLs
- Replaced with: `[URL]`

### ✅ IP Addresses
- IPv4 addresses
- Replaced with: `[REDACTED]`

### ✅ Credit Card Numbers
- Formats: XXXX-XXXX-XXXX-XXXX
- Replaced with: `[REDACTED]`

## Coverage Summary

**HIPAA PHI (18 Identifiers):**
1. ✅ Names
2. ✅ Geographic subdivisions (addresses, zip codes)
3. ✅ Dates (birth, death, admission, discharge)
4. ✅ Telephone numbers
5. ✅ Fax numbers
6. ✅ Email addresses
7. ✅ Social Security numbers
8. ✅ Medical record numbers
9. ✅ Health plan beneficiary numbers (via account numbers)
10. ✅ Account numbers
11. ✅ Certificate/license numbers
12. ⚠️ Vehicle identifiers (not currently filtered - rare in text)
13. ⚠️ Device identifiers (not currently filtered - rare in text)
14. ✅ Web URLs
15. ✅ IP addresses
16. ⚠️ Biometric identifiers (not filterable from text)
17. ⚠️ Full face photos (handled via image filtering instructions)
18. ✅ Other unique identifiers (covered by patterns)

**PII Types:**
- ✅ Names
- ✅ SSN
- ✅ Driver's license numbers
- ✅ Passport numbers
- ✅ Credit card numbers
- ✅ Bank account numbers
- ✅ Email addresses
- ✅ Phone numbers
- ✅ Addresses
- ✅ Dates of birth

## Limitations

1. **Biometric Data**: Cannot be filtered from text (fingerprints, voiceprints require specialized detection)
2. **Vehicle/Device Identifiers**: Rarely appear in text conversations, not currently filtered
3. **Context-Dependent**: Some information might be PHI in medical context but not in general context
4. **Name Variations**: Very common names might have false positives
5. **Age Calculations**: If DOB is filtered but age is mentioned, age might still appear (though we try to prevent this in prompts)

## How It Works

1. **Extraction Phase**: Extracts PHI/PII from user input using regex patterns
2. **AI Prompt Phase**: Instructs models not to include PHI/PII
3. **Filtering Phase**: Post-processes responses to redact any PHI/PII that appears
4. **Context Detection**: Uses medical vs non-medical context for appropriate terminology

## Testing

See `HIPAA_TESTING_GUIDE.md` for test cases and examples.

