import {Router} from "express";
import {z} from "zod";
import {query} from "../db.js";
import {requireAuth,allowRoles} from "../middleware/auth.js";
const router=Router();
router.get("/",async(_req,res,next)=>{try{const r=await query("SELECT id,name,slug,parent_id AS \"parentId\" FROM categories ORDER BY name");res.json({categories:r.rows});}catch(e){next(e);}});
router.post("/",requireAuth,allowRoles("FOUNDER","ADMIN"),async(req,res,next)=>{try{
 const d=z.object({name:z.string().trim().min(2).max(120),slug:z.string().trim().regex(/^[a-z0-9-]+$/),parentId:z.string().uuid().nullable().optional()}).parse(req.body);
 const r=await query("INSERT INTO categories(name,slug,parent_id) VALUES($1,$2,$3) RETURNING id,name,slug,parent_id AS \"parentId\"",[d.name,d.slug,d.parentId||null]);
 res.status(201).json({category:r.rows[0]});
}catch(e){if(e.code==="23505")return res.status(409).json({error:"Category slug already exists"});next(e);}});
export default router;
