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


module.exports = {
    validateData,
    clearValidationLog
};
