const fs = require('fs');
const file = 'd:/BAMBANG_DJAJA/WebDemoTrafo/BambangDjaja/frontend/src/pages/Dashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<div className="flex flex-col gap-1\.5">\s*<label className="text-xs font-semibold text-\[#5e6c84\] dark:text-\[#94a3b8\] uppercase tracking-wider">Akhir \(End\)<\/label>[\s\S]*?<\/div>\s*<\/div>/;

const replaceStr = `              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Akhir (End)</label>
                <input
                  type="datetime-local"
                  value={exportEnd}
                  onChange={(e) => setExportEnd(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none focus:border-green-500 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">Resolusi Data (Aggregation)</label>
                <select
                  value={exportInterval}
                  onChange={(e) => setExportInterval(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none focus:border-green-500 transition-colors"
                >
                  <option className="bg-white dark:bg-[#151521] text-[#172b4d] dark:text-white" value="">Raw Data (Semua Data - Beban Berat)</option>
                  <option className="bg-white dark:bg-[#151521] text-[#172b4d] dark:text-white" value="60">Per 1 Menit (Rata-rata tiap menit)</option>
                  <option className="bg-white dark:bg-[#151521] text-[#172b4d] dark:text-white" value="300">Per 5 Menit (Rata-rata tiap 5 menit)</option>
                  <option className="bg-white dark:bg-[#151521] text-[#172b4d] dark:text-white" value="900">Per 15 Menit (Rata-rata tiap 15 menit)</option>
                  <option className="bg-white dark:bg-[#151521] text-[#172b4d] dark:text-white" value="3600">Per 1 Jam (Rata-rata tiap 1 jam)</option>
                  <option className="bg-white dark:bg-[#151521] text-[#172b4d] dark:text-white" value="86400">Per 1 Hari (Rata-rata tiap 1 hari)</option>
                </select>
              </div>
            </div>`;

if(content.includes('Resolusi Data (Aggregation)')) {
  console.log("Already added");
} else {
  content = content.replace(regex, replaceStr.trim());
  fs.writeFileSync(file, content);
  console.log('Successfully updated UI');
}
