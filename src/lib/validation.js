const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const fs = require("fs");
const path = require("path");

// Validation error log file
const VALIDATION_LOG_FILE = path.join(process.cwd(), 'validation-errors.log');

/**
 * Clear validation log file at start of build
 */
function clearValidationLog() {
    try {
        if (fs.existsSync(VALIDATION_LOG_FILE)) {
            fs.unlinkSync(VALIDATION_LOG_FILE);
        }
    } catch (error) {
        console.warn('Failed to clear validation log:', error.message);
    }
}

/**
 * Write validation errors to log file
 * @param {string} message - Error message to log
 */
function logValidationError(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;

    try {
        fs.appendFileSync(VALIDATION_LOG_FILE, logEntry);
    } catch (error) {
        // Fallback to console if file writing fails
        console.error('Failed to write to validation log:', error.message);
        console.error(message);
    }
}


// Initialize AJV with better error messages
const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    strict: false // Allow additional properties in case schemas need to be flexible
});
addFormats(ajv);

// Load schemas
const SCHEMAS_DIR = path.join(__dirname, "schemas");

function loadSchema(schemaName) {
    try {
        const schemaPath = path.join(SCHEMAS_DIR, `${schemaName}.json`);
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
        return ajv.compile(schema);
    } catch (error) {
        console.error(`⚠️ Could not load schema ${schemaName}:`, error.message);
        return null;
    }
}


// Dynamically load all schemas in the schemas directory
const validators = {};
try {
    const schemaFiles = fs.readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.json'));
    for (const file of schemaFiles) {
        const schemaName = path.basename(file, '.json');
        validators[schemaName] = loadSchema(schemaName);
    }
} catch (err) {
    console.error('⚠️ Could not read schemas directory:', err.message);
}

function validateData(data, schemaType, context = '') {
    const validator = validators[schemaType];
    if (!validator) {
        console.warn(`    ⚠️ No validator found for schema type: ${schemaType}`);
        return { valid: true, errors: [] }; // Skip validation if no schema
    }

    const valid = validator(data);
    if (!valid) {
        const errors = validator.errors.map(error => ({
            path: error.instancePath || error.schemaPath,
            message: error.message,
            data: error.data
        }));

        // Log detailed errors to file
        const errorDetails = [
            `    ❌ Schema validation failed for ${schemaType}${context ? ` (${context})` : ''}:`,
            ...errors.map(error => {
                const lines = [`   • ${error.path}: ${error.message}`];
                if (error.data !== undefined) {
                    lines.push(`     Value: ${JSON.stringify(error.data)}`);
                }
                return lines.join('\n');
            })
        ].join('\n');

        logValidationError(errorDetails);

        // Only show summary in console
        console.error(`    ❌ Schema validation failed for ${schemaType}${context ? ` (${context})` : ''}`);

        return { valid: false, errors };
    }

    return { valid: true, errors: [] };
}

function validateArray(dataArray, schemaType, context = '') {
    const results = dataArray.map((item, index) => ({
        ...validateData(item, schemaType, `${context}[${index}]`),
        item,
        index
    }));

    const validItems = results.filter(result => result.valid).map(result => result.item);
    const invalidItems = results.filter(result => !result.valid);
    const allErrors = results.flatMap(result => result.errors);

    if (invalidItems.length > 0) {
        // Log detailed errors to file
        const errorSummary = [
            `    ❌ Found ${allErrors.length} validation errors in ${schemaType} array`,
            `    ⚠️ Excluding ${invalidItems.length} invalid ${schemaType} items from output`,
            ...invalidItems.map(result => {
                const itemDescription = result.item.filename || result.item.title || `item ${result.index}`;
                const itemErrors = result.errors.map(err => `        - ${err.path}: ${err.message}`).join('\n');
                return `       • Excluded: ${itemDescription}\n${itemErrors}`;
            })
        ].join('\n');

        logValidationError(errorSummary);

        // Only show summary in console
        console.error(`    ❌ Found ${invalidItems.length} invalid ${schemaType} items`);
        invalidItems.forEach(result => {
            const itemDescription = result.item.filename || result.item.title || `item ${result.index}`;
            console.error(`   • Excluded: ${itemDescription}`);
        });
    }

    if (validItems.length > 0) {
        console.log(`    ✅ ${validItems.length} valid ${schemaType} items included`);
    }

    return {
        valid: invalidItems.length === 0,
        errors: allErrors,
        itemResults: results,
        validItems,
        invalidItems: invalidItems.map(result => result.item)
    };
}

function validateAndFilterArray(dataArray, schemaType, context = '') {
    const validationResult = validateArray(dataArray, schemaType, context);
    return validationResult.validItems;
}

module.exports = {
    validateData,
    validateArray,
    validateAndFilterArray,
    validators,
    clearValidationLog
};
