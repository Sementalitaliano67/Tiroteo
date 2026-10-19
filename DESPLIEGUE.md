# Despliegue de Tiroteo

Tiempo estimado: 40 minutos. Hacen falta tres cuentas: GitHub (con acceso a este repo), [Supabase](https://supabase.com) y [Vercel](https://vercel.com) (se puede entrar con GitHub).

## 0. Antes de empezar

- Los cambios de la corrección están en la rama `correccion-spec`. Tienen que estar unidos a `main` en GitHub antes del paso 3, porque Vercel publica `main`.
- Un integrante del grupo hace los pasos con su cuenta y después invita a los demás.

## 1. Crear la base en Supabase

1. En Supabase: **New project**. Nombre `tiroteo`, una contraseña de base que guarden, región **South America (São Paulo)**. Esperen a que termine de crearse (1 o 2 minutos).
2. Menú **SQL Editor** → **New query**. Abran `supabase/instalar.sql` de este repo, copien **todo** el contenido, péguenlo y toquen **Run**.
   - Tiene que terminar con *Success. No rows returned*.
   - Si da error, no lo corran por partes: lean el mensaje y revisen la sección "Problemas comunes".
3. Menú **Authentication** → **Sign In / Providers** → **Email**: desactiven **Confirm email** y guarden. Así una cuenta nueva entra sin confirmar el correo.
4. Menú **Project Settings** → **API Keys** (o **API**): copien la **Project URL** y la clave **anon public**. Las van a usar en el paso 3.

## 2. Probarlo en la computadora (opcional)

```bash
cp .env.example .env      # y completen las dos variables
npm install
npm run dev
```

## 3. Publicar en Vercel

1. En Vercel: **Add New…** → **Project** → importen este repo desde GitHub.
2. Vercel detecta **Vite**. No cambien los comandos.
3. Abran **Environment Variables** y carguen:
   - `VITE_SUPABASE_URL` = la Project URL
   - `VITE_SUPABASE_ANON_KEY` = la clave anon public
4. **Deploy**. Al terminar copien la dirección (algo como `https://tiroteo-xxxx.vercel.app`).

Si se olvidaron de las variables, la página muestra "Falta configurar Supabase". Cárguenlas y en **Deployments** → **⋯** → **Redeploy**.

## 4. Avisarle a Supabase la dirección de la app

En Supabase, **Authentication** → **URL Configuration**:

- **Site URL**: la dirección de Vercel.
- **Redirect URLs**: agreguen `https://LA-DIRECCION.vercel.app/**`.

Sin esto, el enlace del correo de "Recuperar contraseña" lleva a `localhost`.

## 5. Recorrido de verificación

Con dos cuentas (A y B), en dos navegadores o una ventana normal y una de incógnito:

1. A se registra y entra directo a "Hoy".
2. A crea un hábito diario y lo completa: suma XP y la racha pasa a 1. No lo puede completar de nuevo.
3. A recarga la página: el hábito sigue completado.
4. A crea un grupo y copia el código. B se une con el código.
5. A agrega al grupo un hábito de 50 XP. B lo completa y aparece primero en el ranking, en "Esta semana" y en "Total".
6. A da de baja el hábito: B conserva sus 50 XP.
7. B sale del grupo y vuelve a entrar: recupera su XP.
8. En Perfil: cambien el nombre, activen el modo oscuro y pongan un recordatorio un minuto más tarde de la hora actual, con un hábito pendiente. Con la pestaña abierta, aparece el aviso.
9. Estadísticas muestra los hábitos completados.
10. Recuperar contraseña: ver la nota de abajo.

## Notas

- **Correos de Supabase.** Sin un servidor de correo propio, Supabase manda muy pocos correos por hora y solo a las direcciones de los miembros del proyecto. Para probar "Recuperar contraseña", usen el correo de quien creó el proyecto. Para uso real hay que configurar un SMTP propio en **Authentication** → **Emails** → **SMTP Settings**.
- **Recordatorios.** Llegan solo si Tiroteo está abierto en alguna pestaña. Con la app cerrada no hay avisos.
- **XP y racha.** Las calcula la base. Ni la pantalla ni alguien que escriba directo a la base puede modificarlas.

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| "Falta configurar Supabase" | Faltan las variables en Vercel, o se cargaron después del deploy. Revisen los nombres y hagan Redeploy. |
| Al recargar una página da 404 | Falta `vercel.json` en el repo. Tiene que estar en la raíz. |
| `relation "..." already exists` al correr el SQL | El SQL ya se había corrido en ese proyecto. Usen un proyecto nuevo o pidan ayuda al docente. |
| Registrarse no hace nada o pide confirmar el correo | Quedó activado "Confirm email" (paso 1.3). |
| "Invalid API key" | Copiaron otra clave. Es la **anon public**, nunca la `service_role`. |
