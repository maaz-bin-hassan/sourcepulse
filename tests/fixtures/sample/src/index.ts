import { formatName } from "./util.js";
import lodash from "lodash";

const apiUrl = process.env.API_URL;
const missing = process.env.MISSING_KEY;
const token = "replace-me-secret";

console.log(formatName(lodash.camelCase(`${apiUrl}-${missing}-${token}`)));
