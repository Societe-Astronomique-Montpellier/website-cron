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
const endpoint: string = "https://eu.api.ovh.com/1.0";

const DOMAIN: string = 'societe-astronomique-montpellier.fr';
const MAILING_LIST_NAME: string = 'sam-liste';

// CSV
const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = path.dirname(__filename);
const CSV_FILE_PATH:string = path.join(__dirname, '../data/emails.csv');

/**
 * Get OVH timestamp
 */
const generateTimeStamp = async (): Promise<number> => {
    const timeRes = await fetch(`${endpoint}/auth/time`);
    if (!timeRes.ok) {
        throw new Error(`Impossible de récupérer le timestamp OVH`);
    }
    return parseInt(await timeRes.text(), 10);
}

/**
 * Generate OVH API signature
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
    return "$1$" + crypto.createHash('sha1').update(toSign).digest('hex');
};

/**
 * Add new subscriber to SAM-List
 * @param email
 */
const addSubscriberSamList = async (email: string): Promise<string> => {
    const path = `/email/domain/${DOMAIN}/mailingList/${MAILING_LIST_NAME}/subscriber`;
    const body: string = JSON.stringify({
        email: email
    });

    const timestamp: number = await generateTimeStamp();
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
 *
 * @param firstname
 * @param lastname
 * @param email
 */
const addSubscriberCloud = async (firstname: string, lastname: string, email: string): Promise<void> => {};

/**
 * Read CSV file line by line
 * @param filepath
 */
const readCsv = (filepath: string): Promise<any[]> => {
    return new Promise((resolve, reject): void => {
        const results: any[] = [];
        fs.createReadStream(filepath)
            .pipe(csv())
            .on("data", (row) => results.push(row))
            .on("end", () => resolve(results))
            .on("error", reject);
    });
}

/**
 * Main script
 */
const main = async (): Promise<void> => {
    try {
        const rows = await readCsv(CSV_FILE_PATH);
        for (const row of rows) {
            const email = row.email?.trim();
            if (!email) {
                console.warn("⚠️ No email :", row);
                continue;
            }

            try {
                // const newEmail = await addSubscriberSamList(email);
                console.log(`Email ${email} added in SAM-List`);
                // await addSubscriberCloud(row.prenom, row.nom, row.email);
            } catch (error) {
                console.error(`❌ Error for ${email}:`, error);
            }
        }
    } catch (error) {
        console.error(`Error in main script: ${error}`);
    }
}

main().catch((err): void => console.error("❌", err.message));