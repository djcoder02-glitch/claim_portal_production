# Adding Additional Policy Fields

This document explains how to add more fields to the Policy Details form in the future.

## Overview

The Policy Details form (`src/components/claims/PolicyDetailsForm.tsx`) supports dynamic fields based on the policy type. Fields are organized into sections for better user experience.

## How to Add New Fields

### 1. Locate the Field Configuration

Find the `getAdditionalDetailsFields()` function in `src/components/claims/PolicyDetailsForm.tsx` around line 210.

### 2. Field Structure

Each field must have the following properties:

```typescript
{
  name: 'field_name',           // Database column name (use snake_case)
  label: 'Display Label',       // User-friendly label
  type: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox',
  required: boolean,            // Whether field is mandatory
  options?: string[]            // For select fields only
}
```

### 3. Adding Fields to Existing Sections

#### Section 1 - Basic Information (Lines ~220-226)
Add fields related to basic policy and consignment information.

#### Section 2 - Survey & Loss Details (Lines ~228-238)
Add fields related to survey findings and loss descriptions.

#### Section 3 - Transportation Details (Lines ~240-246)
Add fields related to transportation and logistics.

#### Report Text Section (Lines ~248-254)
Add fields for report generation.

### 4. Adding Policy-Type Specific Fields

To add fields that only appear for specific policy types:

```typescript
// Inside getAdditionalDetailsFields() function
if (policyTypeName.includes('marine') || policyTypeName.includes('cargo')) {
  return [
    ...commonFields,
    { name: 'new_marine_field', label: 'New Marine Field', type: 'text', required: false },
    // Add more marine-specific fields here
  ];
}
```

### 5. Supported Field Types

- **text**: Single-line text input
- **number**: Numeric input with validation
- **date**: Date picker
- **textarea**: Multi-line text input (4 rows)
- **select**: Dropdown with predefined options
- **checkbox**: Boolean checkbox

### 6. Example: Adding a New Field

```typescript
// Add this to the commonFields array
{ 
  name: 'customs_declaration', 
  label: 'Customs Declaration Number', 
  type: 'text', 
  required: false 
}

// For a select field with options
{ 
  name: 'damage_severity', 
  label: 'Damage Severity', 
  type: 'select', 
  required: false,
  options: ['Minor', 'Moderate', 'Severe', 'Total Loss']
}
```

### 7. Adding New Sections

To add entirely new sections:

1. Add fields to the `commonFields` array
2. Update the JSX rendering in the form (around line 235)
3. Add the new section with appropriate slicing:

```tsx
{/* New Section - Your Section Name */}
<div className="space-y-4">
  <h4 className="text-md font-medium text-muted-foreground">Your Section Name</h4>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {additionalFields.slice(startIndex, endIndex).map(renderField)}
  </div>
</div>
```

## Database Considerations

- All field data is stored in the `claims.sections` JSONB column
- No database schema changes are needed for new fields
- Field names should use snake_case for consistency
- Data is automatically saved when the form is submitted

## Testing New Fields

1. Add the field configuration
2. Restart the development server
3. Navigate to any claim's Policy Details tab
4. Verify the field appears in the correct section
5. Test saving and loading data

## Best Practices

- Use descriptive field names and labels
- Group related fields in the same section
- Set `required: false` for new fields to avoid breaking existing data
- Use appropriate field types for data validation
- Keep option lists concise and relevant
- Test with different policy types to ensure proper display

## Field Validation

The form uses react-hook-form for validation. Required fields automatically show error messages. For custom validation, modify the `register` call in the `renderField` function.