//Data
import dotenv from 'dotenv';
dotenv.config();


import {Client, createClient, filter, PrismicDocument, asDate} from '@prismicio/client';
import type { DateField, TimestampField } from "@prismicio/types";

// Cron
import cron from 'node-cron';

// Nodemailer
import { createTransport } from "nodemailer";
import path from "path";
import hbs from "nodemailer-express-handlebars";
import type { NodemailerExpressHandlebarsOptions } from "nodemailer-express-handlebars";

const repositoryPrismic: string = process.env.PRISMIC_REPOSITORY as string;
const client: Client = createClient(repositoryPrismic);
const lang: string = "fr-FR";

/**
 * SMTP Config
 */
interface SmtpConfig {
    host: string
    port: number
    secure: boolean
    auth: {
        user: string
        pass: string
    }
};

const smtpConfig: SmtpConfig = {
    host: process.env.SMTP_HOST as string,
    port: parseInt(process.env.SMTP_PORT as string || "465"),
    secure: true,
    auth: {
        user: process.env.SMTP_USER as string,
        pass: process.env.SMTP_PWD as string
    },
}

// Create transporter instance
const transporter = createTransport(smtpConfig);
transporter.verify((err): void => {
    if (err) {
        throw new Error(err.message);
    }
});

const handlebarOptions = {
    viewEngine: {
        extname: ".hbs",
        partialsDir: path.resolve("src/templates/emails/"),
        defaultLayout: false,
    },
    viewPath: path.resolve("src/templates/emails/"),
    extName: ".hbs",
} as NodemailerExpressHandlebarsOptions;
transporter.use("compile", hbs(handlebarOptions));

/**
 * Send email
 *
 * @param subject
 * @param template
 * @param listEvents
*/
const handleSendMail = async (subject: string, template: string, listEvents: PrismicDocument[]): Promise<void> => {
    const mail = {
        from: `"Societe-Astronomique-Montpellier" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_MAILLIST,
        replyTo: process.env.SMTP_MAILLIST,
        subject: subject,
        template: template,
        context: {
            events: listEvents.map((event: PrismicDocument) => {
                return {
                    title: event?.data?.title,
                    dateStart: formatFrenchLongDate(event.data?.time_start),
                    location: event.data.place_event_txt,
                };
            }),
        },
        headers: {
            "List-ID": `"sam-liste" <${process.env.SMTP_MAILLIST}>`,
        },};
    transporter.sendMail(mail, (err, info) => console.log(err || info));
};

/**
 * Format into french format date
 * @param dateString
*/
const formatFrenchLongDate = (dateString: DateField | TimestampField | undefined): string => {
    const prismicDate: Date | null = asDate(dateString);
    const dateFormatter: Intl.DateTimeFormat = new Intl.DateTimeFormat(lang, {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/Paris",
    });
    return dateFormatter.format(prismicDate || undefined);
};

/**
 * DAILY CRON
 */
cron.schedule("0 7 * * *", async(): Promise<void> => {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Start of the day: YYYY-MM-DDT00:00:00Z
    const todayStart = `${today}T00:00:00Z`;

    // End of the day: YYYY-MM-DDT23:59:59Z
    const todayEnd = `${today}T23:59:59Z`;

    try {
        // Query
        const listEvents = await client.getAllByType("event", {
            lang: lang,
            filters: [
                filter.dateBetween("my.event.time_start", todayStart, todayEnd),
            ],
            orderings: {
                field: "my.event.time_start",
                direction: "asc",
            },
        });

        if (0 < listEvents.length) {
            await handleSendMail("Rappel évènement(s) aujourd'hui", "daily", listEvents);
        }
    } catch (error) {
        console.error('[DAILY CRON] error :', error);
    }
});

/**
 * WEEKLY CRON
 */
cron.schedule("0 7 * * 1", async (): Promise<void> => {
    // Get today's date in YYYY-MM-DD format
    const today: string = new Date().toISOString().split("T")[0];

    // Get last day of week from starting today
    const nextWeek: Date = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr: string = nextWeek.toISOString().split("T")[0];

    try {
        const listEvents: PrismicDocument[] = await client.getAllByType("event", {
            lang: "fr-FR",
            filters: [
                filter.dateBetween("my.event.time_start", today, nextWeekStr),
            ],
            orderings: {
                field: "my.event.time_start",
                direction: "asc",
            },
        });

        if (0 < listEvents.length) {
            await handleSendMail("Au programme cette semaine", "weekly", listEvents);
        }
    } catch (error) {
        console.error('[WEEKLY CRON] error :', error)
    }
});