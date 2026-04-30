import { onRequestGet as __functions_admin_api_data_js_onRequestGet } from "C:\\Users\\andy\\wabash-systems\\functions\\functions\\admin\\api\\data.js"
import { onRequestPost as __functions_admin_api_data_js_onRequestPost } from "C:\\Users\\andy\\wabash-systems\\functions\\functions\\admin\\api\\data.js"
import { onRequestGet as __admin_api_data_js_onRequestGet } from "C:\\Users\\andy\\wabash-systems\\functions\\admin\\api\\data.js"
import { onRequestPost as __admin_api_data_js_onRequestPost } from "C:\\Users\\andy\\wabash-systems\\functions\\admin\\api\\data.js"
import { onRequestPost as __functions_api_contact_js_onRequestPost } from "C:\\Users\\andy\\wabash-systems\\functions\\functions\\api\\contact.js"
import { onRequestPost as __api_contact_js_onRequestPost } from "C:\\Users\\andy\\wabash-systems\\functions\\api\\contact.js"
import { onRequestPost as __api_lead_magnet_js_onRequestPost } from "C:\\Users\\andy\\wabash-systems\\functions\\api\\lead-magnet.js"
import { onRequestPost as __api_newsletter_signup_js_onRequestPost } from "C:\\Users\\andy\\wabash-systems\\functions\\api\\newsletter-signup.js"
import { onRequest as __api_lead_magnet_js_onRequest } from "C:\\Users\\andy\\wabash-systems\\functions\\api\\lead-magnet.js"
import { onRequest as __api_newsletter_signup_js_onRequest } from "C:\\Users\\andy\\wabash-systems\\functions\\api\\newsletter-signup.js"
import { onRequest as __functions_admin__middleware_js_onRequest } from "C:\\Users\\andy\\wabash-systems\\functions\\functions\\admin\\_middleware.js"
import { onRequest as __admin__middleware_js_onRequest } from "C:\\Users\\andy\\wabash-systems\\functions\\admin\\_middleware.js"

export const routes = [
    {
      routePath: "/functions/admin/api/data",
      mountPath: "/functions/admin/api",
      method: "GET",
      middlewares: [],
      modules: [__functions_admin_api_data_js_onRequestGet],
    },
  {
      routePath: "/functions/admin/api/data",
      mountPath: "/functions/admin/api",
      method: "POST",
      middlewares: [],
      modules: [__functions_admin_api_data_js_onRequestPost],
    },
  {
      routePath: "/admin/api/data",
      mountPath: "/admin/api",
      method: "GET",
      middlewares: [],
      modules: [__admin_api_data_js_onRequestGet],
    },
  {
      routePath: "/admin/api/data",
      mountPath: "/admin/api",
      method: "POST",
      middlewares: [],
      modules: [__admin_api_data_js_onRequestPost],
    },
  {
      routePath: "/functions/api/contact",
      mountPath: "/functions/api",
      method: "POST",
      middlewares: [],
      modules: [__functions_api_contact_js_onRequestPost],
    },
  {
      routePath: "/api/contact",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_contact_js_onRequestPost],
    },
  {
      routePath: "/api/lead-magnet",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_lead_magnet_js_onRequestPost],
    },
  {
      routePath: "/api/newsletter-signup",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_newsletter_signup_js_onRequestPost],
    },
  {
      routePath: "/api/lead-magnet",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_lead_magnet_js_onRequest],
    },
  {
      routePath: "/api/newsletter-signup",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_newsletter_signup_js_onRequest],
    },
  {
      routePath: "/functions/admin",
      mountPath: "/functions/admin",
      method: "",
      middlewares: [__functions_admin__middleware_js_onRequest],
      modules: [],
    },
  {
      routePath: "/admin",
      mountPath: "/admin",
      method: "",
      middlewares: [__admin__middleware_js_onRequest],
      modules: [],
    },
  ]