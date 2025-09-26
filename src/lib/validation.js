const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const fs = require("fs");
const path = require("path");

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
        console.warn(`⚠️ No validator found for schema type: ${schemaType}`);
        return { valid: true, errors: [] }; // Skip validation if no schema
    }

    const valid = validator(data);
    if (!valid) {
        const errors = validator.errors.map(error => ({
            path: error.instancePath || error.schemaPath,
            message: error.message,
            data: error.data
        }));

        console.error(`❌ Schema validation failed for ${schemaType}${context ? ` (${context})` : ''}:`);
        errors.forEach(error => {
            console.error(`   • ${error.path}: ${error.message}`);
            if (error.data !== undefined) {
                console.error(`     Value: ${JSON.stringify(error.data)}`);
            }
        });

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
        console.error(`❌ Found ${allErrors.length} validation errors in ${schemaType} array`);
        console.error(`⚠️ Excluding ${invalidItems.length} invalid ${schemaType} items from output`);
        invalidItems.forEach(result => {
            const itemDescription = result.item.filename || result.item.title || `item ${result.index}`;
            console.error(`   • Excluded: ${itemDescription}`);
        });
    }

    if (validItems.length > 0) {
        console.log(`✅ ${validItems.length} valid ${schemaType} items included`);
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
    validators
};
