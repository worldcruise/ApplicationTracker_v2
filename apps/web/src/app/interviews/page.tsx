import Bids from '../bids/page';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{organizationId?:string;candidateId?:string;view?:string}>}){const q=await searchParams;return Bids({searchParams:Promise.resolve({...q,view:q.view??'interviews'})});}
