// import { Button } from '@/components/ui/button';
// import {
//   FormControl,
//   FormDescription,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage
// } from '@/components/ui/form';
// import { Input } from '@/components/ui/input';
// import { useSystem } from '@/contexts/SystemContext';
// import { zodResolver } from '@hookform/resolvers/zod';
// import { Form, useForm } from 'react-hook-form';
// import { z } from 'zod';

// const formSchema = z.object({
//   email: z.string().email(),
//   password: z.string().min(8)
// });

// export default function NewSignIn() {
//   const { supabaseConnector } = useSystem();
//   const form = useForm<z.infer<typeof formSchema>>({
//     resolver: zodResolver(formSchema),
//     defaultValues: {
//       email: '',
//       password: ''
//     }
//   });

//   const onSubmit = async (data: z.infer<typeof formSchema>) => {
//     console.log(data);

//     await supabaseConnector.login(data.email, data.password);
//   };

//   return (
//     <Form {...form}>
//       <FormField
//         control={form.control}
//         name="email"
//         render={({ field }) => (
//           <FormItem>
//             <FormLabel>Email</FormLabel>
//             <FormControl>
//               <Input {...field} />
//             </FormControl>
//             <FormDescription>Enter your email</FormDescription>
//             <FormMessage />
//           </FormItem>
//         )}
//       />
//       <FormField
//         control={form.control}
//         name="password"
//         render={({ field }) => (
//           <FormItem>
//             <FormLabel>Password</FormLabel>
//             <FormControl>
//               <Input {...field} />
//             </FormControl>
//             <FormDescription>Enter your password</FormDescription>
//             <FormMessage />
//           </FormItem>
//         )}
//       />
//       <Button onPress={form.handleSubmit(onSubmit)}>Submit</Button>
//     </Form>
//   );
// }
