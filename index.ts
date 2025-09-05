import { Application, Context, Update, ChatPermissions } from 'grammy';
import { ParseMode } from 'grammy/types';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

// إعدادات البوت
const TOKEN = '8097867469:AAFaAjWAOh_LgGHamjh5uUoKWLmYhNEgXpc';
const ADMIN_ID = 7881123172;
const GROUPS_FILE = 'groups.txt';
const MESSAGES_FILE = 'messages.txt';

// بيانات التخزين
let groupsList: number[] = [];
let messagesList: string[] = [];
let activeMessages: Map<number, number> = new Map(); // group_id: message_id
let decoratedTask: any = null;
let currentMsgIndex = 0;
let currentStyleIndex = 0;

// إنشاء تطبيق البوت
const bot = new Application(TOKEN);

// تحميل البيانات من الملفات
async function loadData(): Promise<void> {
  try {
    if (existsSync(GROUPS_FILE)) {
      const data = await readFile(GROUPS_FILE, 'utf-8');
      groupsList = data
        .split('\n')
        .filter(line => line.trim())
        .map(line => parseInt(line.trim()));
    }
  } catch (error) {
    console.error('Error loading groups:', error);
  }

  try {
    if (existsSync(MESSAGES_FILE)) {
      const data = await readFile(MESSAGES_FILE, 'utf-8');
      messagesList = data
        .split('\n')
        .filter(line => line.trim());
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

// حفظ البيانات في الملفات
async function saveData(): Promise<void> {
  try {
    await writeFile(GROUPS_FILE, groupsList.join('\n'));
  } catch (error) {
    console.error('Error saving groups:', error);
  }

  try {
    await writeFile(MESSAGES_FILE, messagesList.join('\n'));
  } catch (error) {
    console.error('Error saving messages:', error);
  }
}

// التحقق من مالك البوت
function isOwner(userId: number): boolean {
  return userId === ADMIN_ID;
}

// تهريب الرموز الخاصة لـ MarkdownV2
function escapeMarkdown(text: string): string {
  const escapeChars = '_*[]()~`>#+-=|{}.!';
  return text.split('').map(char => escapeChars.includes(char) ? `\\${char}` : char).join('');
}

// تزيين الرسالة بنمط معين
function decorateMessage(text: string, style: number): string {
  const escapedText = escapeMarkdown(text);
  const decorations = [
    "✨ {} ✨",
    "⚡ {} ⚡",
    "🌟 {} 🌟",
    "🎉 {} 🎉",
    "💫 {} 💫",
    "🔥 {} 🔥",
    "🌹 {} 🌹",
    "🌸 {} 🌸",
    "🌼 {} 🌼",
    "🌺 {} 🌺",
    "🌻 {} 🌻",
    "🌷 {} 🌷",
    "🌱 {} 🌱",
    "🌿 {} 🌿",
    "🌾 {} 🌾",
    "🌵 {} 🌵",
    "🌴 {} 🌴",
    "🌳 {} 🌳",
    "🌲 {} 🌲",
    "🌰 {} 🌰",
    "🌱 {} 🌱",
    "🌿 {} 🌿",
    "🌾 {} 🌾",
    "🌵 {} 🌵",
    "🌴 {} 🌴",
    "🌳 {} 🌳",
    "🌲 {} 🌲",
    "🌰 {} 🌰",
    "🌱 {} 🌱"
  ];
  return decorations[style % decorations.length].replace('{}', escapedText);
}

// إرسال الرسائل الأولية لجميع المجموعات
async function sendInitialMessages(ctx: Context): Promise<boolean> {
  activeMessages.clear();
  currentMsgIndex = 0;
  currentStyleIndex = 0;

  if (messagesList.length === 0) {
    return false;
  }

  let successCount = 0;
  for (const groupId of groupsList) {
    try {
      const msg = await ctx.api.sendMessage(
        groupId,
        decorateMessage(messagesList[currentMsgIndex], currentStyleIndex),
        { parse_mode: 'MarkdownV2' as ParseMode }
      );
      activeMessages.set(groupId, msg.message_id);
      successCount++;
      await new Promise(resolve => setTimeout(resolve, 500)); // تجنب حظر التليجرام
    } catch (error) {
      console.error(`Error sending to group ${groupId}:`, error);
      try {
        // محاولة إرسال بدون تنسيق إذا فشلت
        const msg = await ctx.api.sendMessage(
          groupId,
          messagesList[currentMsgIndex]
        );
        activeMessages.set(groupId, msg.message_id);
        successCount++;
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error2) {
        console.error(`Also failed to send plain text to group ${groupId}:`, error2);
      }
    }
  }

  return successCount > 0;
}

// تعديل الرسائل بشكل دوري
async function updateMessagesPeriodically(ctx: Context): Promise<void> {
  while (true) {
    try {
      currentStyleIndex++;

      // تغيير الرسالة كل 10 تعديلات
      if (currentStyleIndex % 10 === 0) {
        currentMsgIndex = (currentMsgIndex + 1) % messagesList.length;
        currentStyleIndex = 0;
      }

      // تحديث جميع الرسائل النشطة
      for (const [groupId, messageId] of activeMessages.entries()) {
        try {
          await ctx.api.editMessageText(
            groupId,
            messageId,
            decorateMessage(messagesList[currentMsgIndex], currentStyleIndex),
            { parse_mode: 'MarkdownV2' as ParseMode }
          );
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Error updating message in group ${groupId}:`, error);
          try {
            // محاولة التعديل بدون تنسيق إذا فشلت
            await ctx.api.editMessageText(
              groupId,
              messageId,
              messagesList[currentMsgIndex]
            );
          } catch (error2) {
            console.error(`Also failed to update plain text in group ${groupId}:`, error2);
            activeMessages.delete(groupId);
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500)); // انتظر نصف ثانية بين التحديثات
    } catch (error) {
      console.error('Error in update loop:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// بدء البث المزخرف
bot.command('startdecorated', async (ctx) => {
  if (!isOwner(ctx.from!.id)) {
    await ctx.reply("⚠️ هذا الأمر للمالك فقط!");
    return;
  }

  if (groupsList.length === 0) {
    await ctx.reply("⚠️ لا توجد مجموعات مسجلة!");
    return;
  }

  if (messagesList.length === 0) {
    await ctx.reply("⚠️ لا توجد رسائل مزخرفة!");
    return;
  }

  if (decoratedTask) {
    await ctx.reply("⚠️ البث المزخرف يعمل بالفعل!");
    return;
  }

  // إرسال الرسائل الأولية
  if (!await sendInitialMessages(ctx)) {
    await ctx.reply("⚠️ فشل إرسال الرسائل إلى المجموعات!");
    return;
  }

  // بدء مهمة التحديث الدوري
  decoratedTask = updateMessagesPeriodically(ctx);
  await ctx.reply("🎆 بدأ البث المزخرف بنجاح!");
});

// إيقاف البث المزخرف
bot.command('stopdecorated', async (ctx) => {
  if (!isOwner(ctx.from!.id)) {
    await ctx.reply("⚠️ هذا الأمر للمالك فقط!");
    return;
  }

  if (!decoratedTask) {
    await ctx.reply("ℹ️ لا يوجد بث مزخرف نشط!");
    return;
  }

  // إلغاء المهمة
  decoratedTask = null;
  activeMessages.clear();
  await ctx.reply("⏹ تم إيقاف البث المزخرف!");
});

// إضافة مجموعة/قناة إلى القائمة
bot.command('addgroup', async (ctx) => {
  if (!isOwner(ctx.from!.id)) {
    await ctx.reply("⚠️ هذا الأمر للمالك فقط!");
    return;
  }

  const chatId = ctx.chat!.id;
  if (!groupsList.includes(chatId)) {
    groupsList.push(chatId);
    await saveData();
    await ctx.reply("✅ تمت إضافة المجموعة/القناة بنجاح!");
  } else {
    await ctx.reply("ℹ️ المجموعة/القناة موجودة بالفعل!");
  }
});

// إزالة مجموعة/قناة من القائمة
bot.command('removegroup', async (ctx) => {
  if (!isOwner(ctx.from!.id)) {
    await ctx.reply("⚠️ هذا الأمر للمالك فقط!");
    return;
  }

  const chatId = ctx.chat!.id;
  const index = groupsList.indexOf(chatId);
  if (index !== -1) {
    groupsList.splice(index, 1);
    await saveData();
    await ctx.reply("✅ تمت إزالة المجموعة/القناة بنجاح!");
  } else {
    await ctx.reply("ℹ️ المجموعة/القناة غير موجودة!");
  }
});

// إضافة رسالة مزخرفة
bot.command('addmessage', async (ctx) => {
  if (!isOwner(ctx.from!.id)) {
    await ctx.reply("⚠️ هذا الأمر للمالك فقط!");
    return;
  }

  const message = ctx.match;
  if (!message) {
    await ctx.reply("⚠️ يرجى كتابة الرسالة!");
    return;
  }

  messagesList.push(message);
  await saveData();
  await ctx.reply("✅ تمت إضافة الرسالة المزخرفة بنجاح!");
});

// إزالة رسالة مزخرفة
bot.command('removemessage', async (ctx) => {
  if (!isOwner(ctx.from!.id)) {
    await ctx.reply("⚠️ هذا الأمر للمالك فقط!");
    return;
  }

  const indexStr = ctx.match;
  if (!indexStr) {
    await ctx.reply("⚠️ يرجى تحديد رقم الرسالة!");
    return;
  }

  try {
    const index = parseInt(indexStr) - 1;
    if (index >= 0 && index < messagesList.length) {
      const removed = messagesList.splice(index, 1)[0];
      await saveData();
      await ctx.reply(`✅ تمت إزالة الرسالة:\n${removed}`);
    } else {
      await ctx.reply("⚠️ رقم الرسالة غير صالح!");
    }
  } catch (error) {
    await ctx.reply("⚠️ يرجى إدخال رقم صحيح!");
  }
});

// عرض قائمة الرسائل المزخرفة
bot.command('listmessages', async (ctx) => {
  if (!isOwner(ctx.from!.id)) {
    await ctx.reply("⚠️ هذا الأمر للمالك فقط!");
    return;
  }

  if (messagesList.length === 0) {
    await ctx.reply("ℹ️ لا توجد رسائل مزخرفة!");
    return;
  }

  let msg = "📜 قائمة الرسائل المزخرفة:\n\n";
  messagesList.forEach((message, i) => {
    msg += `${i + 1}. ${message}\n`;
  });

  await ctx.reply(msg);
});

// التحقق من صلاحية المشرف
async function isAdmin(ctx: Context): Promise<boolean> {
  try {
    const chatMember = await ctx.getChatMember(ctx.from!.id);
    return ['creator', 'administrator'].includes(chatMember.status);
  } catch (error) {
    return false;
  }
}

// الحصول على المستخدم المستهدف
async function getTargetUser(ctx: Context): Promise<number | null> {
  if (ctx.message?.reply_to_message) {
    return ctx.message.reply_to_message.from!.id;
  }

  const args = ctx.match?.split(' ') || [];
  if (args.length === 0) {
    await ctx.reply("⚠️ يرجى الرد على المستخدم أو كتابة @يوزر!");
    return null;
  }

  try {
    if (args[0].startsWith("@")) {
      const user = await ctx.api.getChat(args[0]);
      return user.id;
    }
    return parseInt(args[0]);
  } catch (error) {
    await ctx.reply("⚠️ يوزر غير صالح!");
    return null;
  }
}

// حظر مستخدم
bot.command('ban', async (ctx) => {
  if (!await isAdmin(ctx)) {
    await ctx.reply("⚠️ ليس لديك صلاحية!");
    return;
  }

  const userId = await getTargetUser(ctx);
  if (!userId) return;

  try {
    await ctx.banChatMember(userId);
    await ctx.reply("✅ تم حظر المستخدم بنجاح!");
  } catch (error: any) {
    await ctx.reply(`❌ خطأ: ${error.message}`);
  }
});

// كتم مستخدم
bot.command('mute', async (ctx) => {
  if (!await isAdmin(ctx)) {
    await ctx.reply("⚠️ ليس لديك صلاحية!");
    return;
  }

  const userId = await getTargetUser(ctx);
  if (!userId) return;

  try {
    const permissions: ChatPermissions = {
      can_send_messages: false,
      can_send_media_messages: false,
      can_send_polls: false,
      can_send_other_messages: false,
      can_add_web_page_previews: false,
      can_change_info: false,
      can_invite_users: false,
      can_pin_messages: false
    };
    await ctx.restrictChatMember(userId, permissions);
    await ctx.reply("✅ تم كتم المستخدم بنجاح!");
  } catch (error: any) {
    await ctx.reply(`❌ خطأ: ${error.message}`);
  }
});

// ترقية مستخدم إلى مشرف
bot.command('promote', async (ctx) => {
  if (!await isAdmin(ctx)) {
    await ctx.reply("⚠️ ليس لديك صلاحية!");
    return;
  }

  const userId = await getTargetUser(ctx);
  if (!userId) return;

  try {
    await ctx.promoteChatMember(userId, {
      can_change_info: true,
      can_post_messages: true,
      can_edit_messages: true,
      can_delete_messages: true,
      can_invite_users: true,
      can_restrict_members: true,
      can_pin_messages: true,
      can_promote_members: false
    });
    await ctx.reply("✅ تم ترقية المستخدم بنجاح!");
  } catch (error: any) {
    await ctx.reply(`❌ خطأ: ${error.message}`);
  }
});

// بدء تشغيل البوت
async function startBot() {
  await loadData();
  console.log("✅ البوت يعمل بنجاح...");
  await bot.start();
}

// تشغيل البوت
startBot().catch(console.error);

// دعم Vercel Serverless Functions
export default async function handler(req: any, res: any) {
  try {
    await bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling update:', error);
    res.status(500).send('Error');
  }
    }
