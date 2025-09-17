//Data
import dotenv from 'dotenv';
import fs from 'fs';
import * as crypto from 'crypto';
import csv from 'csv-parser';
import path from "path";
import {fileURLToPath} from "node:url";

dotenv.config();

/**
 * KEY
 */
const OVH_APP_KEY: string | undefined = process.env.APP_KEY ?? '';
const OVH_APP_SECRET: string | undefined = process.env.APP_SECRET;
const OVH_CONSUMER_KEY: string | undefined = process.env.CONSUMER_KEY ?? '';
const endpoint = "https://eu.api.ovh.com/1.0";

const DOMAIN: string = 'societe-astronomique-montpellier.fr';
const MAILING_LIST_NAME = 'sam-liste';

// CSV
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_FILE_PATH = path.join(__dirname, '../data/emails.csv');


/**
 *
 * @param method
 * @param path
 * @param timestamp
 * @param body
 */
const generateSignature = (method: string, path: string, timestamp: number, body: any) => {
    const toSign = [
        OVH_APP_SECRET,
        OVH_CONSUMER_KEY,
        method,
        endpoint + path,
        body,
        timestamp,
    ].join('+');
    return "$1$" +
        crypto
            .createHash('sha1')
            .update(toSign)
            .digest('hex');
};

/**
 * Get Token
 */
// const getToken = async (): Promise<string> => {
//     const timestamp: number = Math.floor(Date.now() / 1000);
//     const path: string = '/auth/credential';
//     const signature: string = generateSignature('POST', path, timestamp);
//
//     try {
//         let response: Response = await fetch(`${endpoint}/auth/credential`, {
//             method: 'POST',
//             headers: {
//                 'X-Ovh-Application': OVH_APP_KEY,
//                 'X-Ovh-Timestamp': timestamp.toString(),
//                 'X-Ovh-Signature': `$1$${signature}`,
//                 'X-Ovh-Consumer': OVH_CONSUMER_KEY,
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({
//                 accessRules: [
//                     {
//                         method: 'POST',
//                         path: `/email/domain/${DOMAIN}/mailingList/${MAILING_LIST_NAME}/subscriber`
//                     },
//                 ]
//             })
//         });
//         const data = await response.json();
//         if (!response.ok) throw new Error(data.message || 'Erreur lors de la récupération du token');
//
//         console.log(data);
//
//         return data.consumerKey;
//     } catch (error) {
//         console.error('Erreur lors de la récupération du token:', error);
//         throw error;
//     }
// }

/**
 * Add new subscriber to SAM-List
 * @param token
 * @param email
 */
const addSubscriberSamList = async (email: string): Promise<string> => {
    const timeRes = await fetch(`${endpoint}/auth/time`);
    const ovhTime = await timeRes.text();
    const timestamp = parseInt(ovhTime, 10);
    const path = `/email/domain/${DOMAIN}/mailingList/${MAILING_LIST_NAME}/subscriber`;

    const body: string = JSON.stringify({
        email: email
    });

    const signature = generateSignature('POST', path, timestamp, body);
    let response: Response = await fetch(`${endpoint}${path}`, {
        method: 'POST',
        headers: {
            'X-Ovh-Application': OVH_APP_KEY,
            'X-Ovh-Consumer': OVH_CONSUMER_KEY,
            'X-Ovh-Signature': `${signature}`,
            'X-Ovh-Timestamp': timestamp.toString(),
            'Content-Type': 'application/json',
        },
        body
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Erreur API OVH: ${response.status} ${err}`);
    }

   return await response.json();
};

/**
 * Add subscriber into SAM Nuage
 */
const addSubscriberCloud = async (): Promise<void> => {

};

const main = async (): Promise<void> => {
    try {
        const emails: string[] = [];
        fs.createReadStream(CSV_FILE_PATH)
            .pipe(csv())
            .on('data', (data) => {
                if (data['email']) {
                    emails.push(data['email']);
                }
            })
            .on('end', async  () => {
                for (const email of emails) {
                    try {
                        const newEmail = await addSubscriberSamList(email);
                        console.log(`Add new user ${newEmail}`);
                        // await addSubscriberCloud();
                    } catch (error) {
                        console.error(`❌ Erreur pour ${email}:`, error);
                    }
                }
            })

    } catch (error) {
        console.error(`Error in main script: ${error}`);
    }
}

main().catch((err) => console.error("❌", err.message));