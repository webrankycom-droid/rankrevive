@echo off
cd /d "D:\saass tool"
git add -A
git commit -m "Initial scaffold: RankRevive AI-powered SEO Recovery SaaS"
git remote remove origin 2>nul
git remote add origin https://github.com/webrankycom-droid/rankrevive.git
git branch -M main
git push origin main --force
echo DONE > push-result.txt
