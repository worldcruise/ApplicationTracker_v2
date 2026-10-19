// @ts-nocheck
// Generated from unchanged resume-v1.json by compile-resume-schema.mjs; do not edit.
"use strict";
export const validate = validate20;
export default validate20;
const schema31 = {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["company","title","summary","skills","experience","education"],"properties":{"company":{"type":"string"},"title":{"type":"string"},"summary":{"type":"string"},"skills":{"type":"array","items":{"type":"object","minProperties":1,"additionalProperties":{"type":"array","items":{"type":"string"}}}},"experience":{"type":"array","items":{"type":"object","required":["title","company","sentences"],"properties":{"title":{"type":"string"},"company":{"type":"string"},"sentences":{"type":"array","items":{"type":"string"}}}}},"education":{"type":"array","items":{"type":"object","required":["degree"],"properties":{"degree":{"type":"string"}}}}}};

function validate20(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
let vErrors = null;
let errors = 0;
const evaluated0 = validate20.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(data && typeof data == "object" && !Array.isArray(data)){
if(data.company === undefined){
const err0 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "company"},message:"must have required property '"+"company"+"'"};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
if(data.title === undefined){
const err1 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "title"},message:"must have required property '"+"title"+"'"};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
}
if(data.summary === undefined){
const err2 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "summary"},message:"must have required property '"+"summary"+"'"};
if(vErrors === null){
vErrors = [err2];
}
else {
vErrors.push(err2);
}
errors++;
}
if(data.skills === undefined){
const err3 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "skills"},message:"must have required property '"+"skills"+"'"};
if(vErrors === null){
vErrors = [err3];
}
else {
vErrors.push(err3);
}
errors++;
}
if(data.experience === undefined){
const err4 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "experience"},message:"must have required property '"+"experience"+"'"};
if(vErrors === null){
vErrors = [err4];
}
else {
vErrors.push(err4);
}
errors++;
}
if(data.education === undefined){
const err5 = {instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: "education"},message:"must have required property '"+"education"+"'"};
if(vErrors === null){
vErrors = [err5];
}
else {
vErrors.push(err5);
}
errors++;
}
if(data.company !== undefined){
if(typeof data.company !== "string"){
const err6 = {instancePath:instancePath+"/company",schemaPath:"#/properties/company/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err6];
}
else {
vErrors.push(err6);
}
errors++;
}
}
if(data.title !== undefined){
if(typeof data.title !== "string"){
const err7 = {instancePath:instancePath+"/title",schemaPath:"#/properties/title/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err7];
}
else {
vErrors.push(err7);
}
errors++;
}
}
if(data.summary !== undefined){
if(typeof data.summary !== "string"){
const err8 = {instancePath:instancePath+"/summary",schemaPath:"#/properties/summary/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err8];
}
else {
vErrors.push(err8);
}
errors++;
}
}
if(data.skills !== undefined){
let data3 = data.skills;
if(Array.isArray(data3)){
const len0 = data3.length;
for(let i0=0; i0<len0; i0++){
let data4 = data3[i0];
if(data4 && typeof data4 == "object" && !Array.isArray(data4)){
if(Object.keys(data4).length < 1){
const err9 = {instancePath:instancePath+"/skills/" + i0,schemaPath:"#/properties/skills/items/minProperties",keyword:"minProperties",params:{limit: 1},message:"must NOT have fewer than 1 properties"};
if(vErrors === null){
vErrors = [err9];
}
else {
vErrors.push(err9);
}
errors++;
}
for(const key0 in data4){
let data5 = data4[key0];
if(Array.isArray(data5)){
const len1 = data5.length;
for(let i1=0; i1<len1; i1++){
if(typeof data5[i1] !== "string"){
const err10 = {instancePath:instancePath+"/skills/" + i0+"/" + key0.replace(/~/g, "~0").replace(/\//g, "~1")+"/" + i1,schemaPath:"#/properties/skills/items/additionalProperties/items/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err10];
}
else {
vErrors.push(err10);
}
errors++;
}
}
}
else {
const err11 = {instancePath:instancePath+"/skills/" + i0+"/" + key0.replace(/~/g, "~0").replace(/\//g, "~1"),schemaPath:"#/properties/skills/items/additionalProperties/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err11];
}
else {
vErrors.push(err11);
}
errors++;
}
}
}
else {
const err12 = {instancePath:instancePath+"/skills/" + i0,schemaPath:"#/properties/skills/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err12];
}
else {
vErrors.push(err12);
}
errors++;
}
}
}
else {
const err13 = {instancePath:instancePath+"/skills",schemaPath:"#/properties/skills/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err13];
}
else {
vErrors.push(err13);
}
errors++;
}
}
if(data.experience !== undefined){
let data7 = data.experience;
if(Array.isArray(data7)){
const len2 = data7.length;
for(let i2=0; i2<len2; i2++){
let data8 = data7[i2];
if(data8 && typeof data8 == "object" && !Array.isArray(data8)){
if(data8.title === undefined){
const err14 = {instancePath:instancePath+"/experience/" + i2,schemaPath:"#/properties/experience/items/required",keyword:"required",params:{missingProperty: "title"},message:"must have required property '"+"title"+"'"};
if(vErrors === null){
vErrors = [err14];
}
else {
vErrors.push(err14);
}
errors++;
}
if(data8.company === undefined){
const err15 = {instancePath:instancePath+"/experience/" + i2,schemaPath:"#/properties/experience/items/required",keyword:"required",params:{missingProperty: "company"},message:"must have required property '"+"company"+"'"};
if(vErrors === null){
vErrors = [err15];
}
else {
vErrors.push(err15);
}
errors++;
}
if(data8.sentences === undefined){
const err16 = {instancePath:instancePath+"/experience/" + i2,schemaPath:"#/properties/experience/items/required",keyword:"required",params:{missingProperty: "sentences"},message:"must have required property '"+"sentences"+"'"};
if(vErrors === null){
vErrors = [err16];
}
else {
vErrors.push(err16);
}
errors++;
}
if(data8.title !== undefined){
if(typeof data8.title !== "string"){
const err17 = {instancePath:instancePath+"/experience/" + i2+"/title",schemaPath:"#/properties/experience/items/properties/title/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err17];
}
else {
vErrors.push(err17);
}
errors++;
}
}
if(data8.company !== undefined){
if(typeof data8.company !== "string"){
const err18 = {instancePath:instancePath+"/experience/" + i2+"/company",schemaPath:"#/properties/experience/items/properties/company/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err18];
}
else {
vErrors.push(err18);
}
errors++;
}
}
if(data8.sentences !== undefined){
let data11 = data8.sentences;
if(Array.isArray(data11)){
const len3 = data11.length;
for(let i3=0; i3<len3; i3++){
if(typeof data11[i3] !== "string"){
const err19 = {instancePath:instancePath+"/experience/" + i2+"/sentences/" + i3,schemaPath:"#/properties/experience/items/properties/sentences/items/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err19];
}
else {
vErrors.push(err19);
}
errors++;
}
}
}
else {
const err20 = {instancePath:instancePath+"/experience/" + i2+"/sentences",schemaPath:"#/properties/experience/items/properties/sentences/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err20];
}
else {
vErrors.push(err20);
}
errors++;
}
}
}
else {
const err21 = {instancePath:instancePath+"/experience/" + i2,schemaPath:"#/properties/experience/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err21];
}
else {
vErrors.push(err21);
}
errors++;
}
}
}
else {
const err22 = {instancePath:instancePath+"/experience",schemaPath:"#/properties/experience/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err22];
}
else {
vErrors.push(err22);
}
errors++;
}
}
if(data.education !== undefined){
let data13 = data.education;
if(Array.isArray(data13)){
const len4 = data13.length;
for(let i4=0; i4<len4; i4++){
let data14 = data13[i4];
if(data14 && typeof data14 == "object" && !Array.isArray(data14)){
if(data14.degree === undefined){
const err23 = {instancePath:instancePath+"/education/" + i4,schemaPath:"#/properties/education/items/required",keyword:"required",params:{missingProperty: "degree"},message:"must have required property '"+"degree"+"'"};
if(vErrors === null){
vErrors = [err23];
}
else {
vErrors.push(err23);
}
errors++;
}
if(data14.degree !== undefined){
if(typeof data14.degree !== "string"){
const err24 = {instancePath:instancePath+"/education/" + i4+"/degree",schemaPath:"#/properties/education/items/properties/degree/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err24];
}
else {
vErrors.push(err24);
}
errors++;
}
}
}
else {
const err25 = {instancePath:instancePath+"/education/" + i4,schemaPath:"#/properties/education/items/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err25];
}
else {
vErrors.push(err25);
}
errors++;
}
}
}
else {
const err26 = {instancePath:instancePath+"/education",schemaPath:"#/properties/education/type",keyword:"type",params:{type: "array"},message:"must be array"};
if(vErrors === null){
vErrors = [err26];
}
else {
vErrors.push(err26);
}
errors++;
}
}
}
else {
const err27 = {instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err27];
}
else {
vErrors.push(err27);
}
errors++;
}
validate20.errors = vErrors;
return errors === 0;
}
validate20.evaluated = {"props":{"company":true,"title":true,"summary":true,"skills":true,"experience":true,"education":true},"dynamicProps":false,"dynamicItems":false};

