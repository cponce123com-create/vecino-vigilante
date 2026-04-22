import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contratacionesRouter from "./contrataciones";
import distritosRouter from "./distritos";
import entidadesRouter from "./entidades";
import proveedoresRouter from "./proveedores";
import statsRouter from "./stats";
import observatorioRouter from "./observatorio";
import excelRouter from "./excel";
import syncRouter from "./sync";
import pndaRouter from "./pnda";


const router: IRouter = Router();

router.use(healthRouter);
router.use(contratacionesRouter);
router.use(distritosRouter);
router.use(entidadesRouter);
router.use(proveedoresRouter);
router.use(statsRouter);
router.use(observatorioRouter);
router.use(excelRouter);
router.use(syncRouter);
router.use(pndaRouter);

export default router;
