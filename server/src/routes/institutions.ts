import { Router } from "express";
import { listInstitutions, getInstitution } from "../adapters/institutions";
import { InstitutionId } from "../models/types";

export const institutionsRouter = Router();

institutionsRouter.get("/", (_req, res) => {
  res.json({ institutions: listInstitutions() });
});

institutionsRouter.get("/:id", (req, res) => {
  const inst = getInstitution(req.params.id as InstitutionId);
  if (!inst) return res.status(404).json({ error: "Institution not found" });
  res.json(inst);
});
