import * as cc from 'five-bells-condition';
import crypto from 'crypto'; // use Node.js crypto module

export function generateCondition() {
    // 1. Generate a random 32-byte seed
    const preimageData = crypto.randomBytes(32);

    // 2. Create a PreimageSha256 fulfillment object
    const fulfillment = new cc.PreimageSha256();

    // 3. Set the preimage
    fulfillment.setPreimage(preimageData);

    // 4. Generate the condition (binary)
    const conditionBinary = fulfillment.getConditionBinary();

    // 5. Generate the fulfillment (binary)
    const fulfillmentBinary = fulfillment.serializeBinary();

    // Convert to hex for easier use
    const conditionHex = conditionBinary.toString('hex').toUpperCase();
    const fulfillmentHex = fulfillmentBinary.toString('hex').toUpperCase();

    console.log('Condition (hex):', conditionHex);
    console.log('Fulfillment (hex):', fulfillmentHex);
    return { conditionHex, fulfillmentHex };
}
