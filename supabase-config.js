/* Supabase 접속 정보 — 이 파일 하나만 교체하면 환경이 바뀝니다.
   다른 파일에 주소를 하드코딩하지 않습니다.

   anon key 는 공개 전제 키입니다. 브라우저 코드에 그대로 들어가고 저장소에 커밋해도 됩니다.
   "누구인지"가 아니라 "어느 프로젝트인지"만 가리키며, 실제 방어는 DB 의 RLS 가 합니다.
   service_role key 와 DB 비밀번호는 절대 여기 넣지 않습니다. (DB_DESIGN.md 참고) */

'use strict';

const SUPABASE_CONFIG = {
  url: 'https://lfdwrfoxmrysqzlvrdqk.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmZHdyZm94bXJ5c3F6bHZyZHFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNDA2ODAsImV4cCI6MjEwMzYxNjY4MH0.ue-Tiihb1YxfTwW3eBggFf285iF3iRrDFRy6vJaUVto',
};
