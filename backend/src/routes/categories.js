import {Router} from "express";
import {z} from "zod";
import {query} from "../db.js";
import {requireAuth,allowRoles} from "../middleware/auth.js";
const router=Router();
const fields='id,name,slug,parent_id AS "parentId",image_url AS "imageUrl",position,is_active AS "isActive"';
router.get("/",async(_req,res,next)=>{try{const r=await query(`SELECT ${fields} FROM categories WHERE is_active=TRUE ORDER BY position,name`);res.json({categories:r.rows});}catch(e){next(e);}});
router.post("/",requireAuth,allowRoles("FOUNDER","ADMIN"),async(req,res,next)=>{try{
 const d=z.object({name:z.string().trim().min(2).max(120),slug:z.string().trim().regex(/^[a-z0-9-]+$/),imageUrl:z.string().trim().url().max(1000),position:z.number().int().min(0).optional(),isActive:z.boolean().optional()}).parse(req.body);
 const r=await query(`INSERT INTO categories(name,slug,image_url,position,is_active) VALUES($1,$2,$3,$4,$5) RETURNING ${fields}`,[d.name,d.slug,d.imageUrl,d.position??0,d.isActive??true]);
 res.status(201).json({category:r.rows[0]});
}catch(e){if(e.code==="23505")return res.status(409).json({error:"Category slug already exists"});next(e);}});
router.patch("/:id",requireAuth,allowRoles("FOUNDER","ADMIN"),async(req,res,next)=>{try{
 const d=z.object({name:z.string().trim().min(2).max(120),slug:z.string().trim().regex(/^[a-z0-9-]+$/),imageUrl:z.string().trim().url().max(1000),position:z.number().int().min(0),isActive:z.boolean()}).partial().refine(x=>Object.keys(x).length>0).parse(req.body);
 const map={name:"name",slug:"slug",imageUrl:"image_url",position:"position",isActive:"is_active"},sets=[],vals=[];
 for(const [k,v] of Object.entries(d)){vals.push(v);sets.push(map[k]+`=$${vals.length}`)}
 vals.push(req.params.id);
 const r=await query(`UPDATE categories SET ${sets.join(",")} WHERE id=$${vals.length} RETURNING ${fields}`,vals);
 if(!r.rowCount)return res.status(404).json({error:"Category not found"});res.json({category:r.rows[0]});
}catch(e){if(e.code==="23505")return res.status(409).json({error:"Category slug already exists"});next(e);}});
router.delete("/:id",requireAuth,allowRoles("FOUNDER","ADMIN"),async(req,res,next)=>{try{
 const r=await query("DELETE FROM categories WHERE id=$1 RETURNING id",[req.params.id]);
 if(!r.rowCount)return res.status(404).json({error:"Category not found"});res.json({success:true});
}catch(e){next(e);}});
export default router;
